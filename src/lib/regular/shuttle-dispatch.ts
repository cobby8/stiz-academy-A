import {
  buildDispatchFromRiders,
  type DispatchDirection,
  type DispatchRiderInput,
  type DispatchSuggestion,
} from "@/lib/seasonal/shuttle-optimize";
import { getRegularShuttleRiders } from "./shuttleRoster";
import type { RegularShuttleRider } from "./shuttleRosterLogic";

/**
 * 정규 수업 셔틀 동적배차 (Phase 1) — 서버 · 계산 함수.
 *
 * 방학특강 배차 엔진(buildDispatchFromRiders: 차량·정차·T맵 실도로·시각)을 **그대로 재사용**하되,
 * 입력 명단만 정규 정합 명단(getRegularShuttleRiders)으로 바꾼다.
 *
 * 재사용 방식(택 a): 배차 코어를 "명단 소스 독립"으로 뽑아(buildDispatchFromRiders) seasonal·regular 가 공유.
 *   - 이유: planRun/nnOrder/routeSegmentsWithTmap/정원배차/ETA 는 명단 출처와 무관한 순수 배차 로직이라
 *     복제(b안)하면 두 벌을 따로 유지해야 해 장기 회귀 위험이 더 크다. 코어를 한 벌로 공유하는 편이 안전.
 *   - seasonal 회귀 없음: computeDispatch 는 기존과 동일한 데이터를 준비해 코어에 넘기기만 한다(로직 이동뿐).
 *
 * ⚠️ 저장/화면 연결(관리자 화면·저장 roster)은 Phase 2. 이 함수는 "호출 시 배차 제안 반환"까지만.
 * ⚠️ T맵은 방학특강과 동일하게 "편집/계산 시에만" 호출(localOnly=true 면 미호출·직선 추정).
 * ⚠️ 스키마 변경 없음(계산만). 기존 seasonal/구글시트 정규 셔틀 무변경.
 */

const DOW_KO: Record<string, string> = {
  Sun: "일", Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토",
};

/**
 * 정규 라이더(방향 반영 완료)를 배차 코어 입력 계약(DispatchRiderInput)으로 옮긴다.
 *   - shuttleRequestId: 정규엔 셔틀신청 레코드가 없으므로 studentId 를 정차-학생 식별 키로 쓴다.
 *   - rosterId: 확정본(저장 노선)이 없는 계산 단계라 null.
 *   - place.source: 정규 좌표는 신청서 지오코딩 → 핀 고정이 아니므로 null(코어에서 approx 로 표시).
 */
function toDispatchRider(r: RegularShuttleRider): DispatchRiderInput {
  return {
    studentName: r.studentName,
    childGrade: r.childGrade,
    parentPhone: r.parentPhone,
    childPhone: r.childPhone,
    rosterId: null,
    shuttleRequestId: r.studentId,
    applicationId: r.applicationId,
    placeLabel: r.placeLabel,
    place: {
      latitude: r.place.latitude,
      longitude: r.place.longitude,
      source: null,
    },
  };
}

export type ComputeRegularDispatchOptions = {
  direction: DispatchDirection;
  /** 차량표 적용 월('YYYY-MM'). 없으면 최신 월. */
  serviceMonth?: string;
  /** Class.dayOfWeek 문자열("Mon" 등). date 보다 우선한다. */
  dayOfWeek?: string;
  /** 'YYYY-MM-DD'. dayOfWeek 미지정 시 이 날짜의 요일로 명단을 뽑는다. */
  date?: string;
  /** true 면 T맵 미호출(직선 추정) — 조회/제공량 절약. 기본 false(계산 시 T맵 실도로). */
  localOnly?: boolean;
};

/**
 * 정규 셔틀 배차 제안을 계산한다(그 요일/그 날짜 명단 기준).
 * 반환 shape 는 방학특강과 동일한 DispatchSuggestion(vehicles→stops→students, path·etaLabel·etaMinutes·
 * provider, unassigned, totalRiders 등)이라 Phase 2 화면·저장이 방학특강 뷰를 그대로 재사용할 수 있다.
 */
export async function computeRegularDispatch(
  opts: ComputeRegularDispatchOptions,
): Promise<DispatchSuggestion> {
  const direction: DispatchDirection = opts.direction === "DROPOFF" ? "DROPOFF" : "PICKUP";
  const localOnly = opts.localOnly === true;

  // 명단 = 그 요일(또는 날짜의 요일) × 방향의 정규 정합 라이더. 좌표 없는 이용자는 roster.unassigned 로 분리돼 온다.
  const roster = await getRegularShuttleRiders({
    direction,
    serviceMonth: opts.serviceMonth,
    dayOfWeek: opts.dayOfWeek,
    date: opts.date,
  });

  // 좌표 있는 라이더 + 좌표 없는 이용자(roster.unassigned)를 함께 코어에 넘긴다.
  // 코어가 좌표 유무로 다시 나눠 coordless 를 suggestion.unassigned 로 분리한다(방학특강과 동일 처리).
  const riders = [...roster.riders, ...roster.unassigned].map(toDispatchRider);

  // 정규는 요일 기반 상시 운행이라 "운행일 후보(availableDates)" 개념이 없다.
  // 코어의 date 게이트는 "운행 성립 식별자"이므로, 실제 날짜가 있으면 그걸, 없으면 요일명을 넣어 파이프라인을 태운다.
  const date = opts.date ?? roster.dayOfWeek;
  const dow = DOW_KO[roster.dayOfWeek] ?? null;

  // 수업 시각 앵커: 같은 요일이라도 반마다 시작/종료가 다를 수 있다(정규 특성).
  // Phase 1 단일 앵커로는 가장 이른 시작·가장 늦은 종료를 써서 아무도 늦지 않게 잡는다(Phase 2에서 반별 분리 여지).
  const starts = roster.riders.map((r) => r.classStart).filter((v): v is string => !!v);
  const ends = roster.riders.map((r) => r.classEnd).filter((v): v is string => !!v);
  const classStart = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null;
  const classEnd = ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null;

  return buildDispatchFromRiders({
    direction,
    date,
    dow,
    availableDates: [], // 정규는 요일 상시 운행 — 날짜 선택 목록 없음(Phase 2에서 요일 네비로 대체 가능).
    classStart,
    classEnd,
    riders,
    localOnly,
  });
}
