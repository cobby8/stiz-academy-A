import { getRegularShuttleStops } from "./regularImport";
import { getRegularAbsentPeople } from "./regularRun";
import { getShuttleExceptionsForDate } from "./parent-shuttle-exception";
import { describeException } from "./dayExceptionRules";
import { getSavedRegularDispatchRoute } from "@/lib/regular/regularDispatchRoute";
import { getRegularShuttleRiders } from "@/lib/regular/shuttleRoster";
import { DOW_NAMES } from "@/lib/regular/shuttleRosterLogic";
import { matchAbsentee } from "@/lib/regular/regularAbsenceMatch";
import {
  assembleRegularDriverClasses,
  attachShuttleDayNotes,
  pickRegularRouteSource,
  type DriverClass,
  type RouteDirection,
} from "./regularDriverRouteLogic";
import type { RegularShuttleStop } from "./regularSheet";

/**
 * 정규 셔틀 기사님 화면의 "그날 무엇을 보여 줄지"를 한곳에서 만든다(서버 전용).
 *
 * 우선순위:
 *   1) 그 요일의 저장된 정규 배차 노선(RegularDispatchRoute) — 원장이 순서·시각을 확정한 노선.
 *   2) 없으면 구글시트 명단(RegularShuttleStop) 그대로 = 종전 동작(폴백, '확정 전' 표시).
 *
 * ⚠️ 탑승 체크(ShuttleBoarding, direction='REGULAR')의 저장·조회 경로는 손대지 않는다.
 *    저장 노선을 쓰더라도 각 학생의 rowId 는 예전과 같은 **시트 정차행 id** 로 되돌려 넘긴다.
 *    (저장 payload 의 학생 식별자는 studentId 라서 그대로 쓰면 과거 체크 기록이 끊긴다.)
 *
 * ⚠️ PgBouncer 트랜잭션 모드 → 하위 조회는 모두 $queryRawUnsafe 를 쓰는 기존 함수만 호출한다.
 */

// KST 날짜의 요일(0=일 … 6=토). 정오 기준이라 UTC 변환에도 날짜가 밀리지 않는다.
function weekdayOf(dateIso: string): number {
  return new Date(`${dateIso}T12:00:00+09:00`).getUTCDay();
}

const DIRECTIONS: RouteDirection[] = ["PICKUP", "DROPOFF"];

/** 그 요일·방향의 "라이더 studentId → 시트 정차행 id 목록"(시트 순서). 저장 노선 ↔ 탑승체크 키 다리. */
async function loadRowIdsByStudentId(
  dayOfWeek: string,
  direction: RouteDirection,
  orderIndex: Map<string, number>,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  try {
    const roster = await getRegularShuttleRiders({ direction, dayOfWeek });
    // 좌표 없는 이용자(unassigned)도 포함해야 저장 노선에 남아 있는 학생을 놓치지 않는다.
    for (const rider of [...roster.riders, ...roster.unassigned]) {
      const rowId = rider.stopRowId ?? null;
      if (!rowId) continue;
      const list = out.get(rider.studentId) ?? [];
      list.push(rowId);
      out.set(rider.studentId, list);
    }
    // 같은 학생이 여러 행을 가질 때(시트 중복·오분류) 시트 순서대로 소비되도록 정렬한다.
    for (const list of out.values()) list.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
  } catch {
    // 명단 조회 실패 → 빈 매핑. 저장 노선은 그대로 보이고, 시트 행은 '노선에 없는 승객'으로 전부 노출된다.
  }
  return out;
}

/** 기사님 화면(정규)의 그날 섹션 목록. 두 기사님 화면(/driver/[token], /shuttle/regular/[token])이 공유한다. */
export async function getRegularDriverClasses(viewDate: string): Promise<DriverClass[]> {
  const weekday = weekdayOf(viewDate);
  const dayOfWeek = DOW_NAMES[weekday];

  const [{ stops }, absentees, shuttleExceptions] = await Promise.all([
    getRegularShuttleStops(),
    getRegularAbsentPeople(viewDate),
    getShuttleExceptionsForDate(viewDate),
  ]);

  // 그 요일의 학생 정차행만(승차/하차). 시트 순서 유지 — 폴백 화면은 이 순서가 곧 운행 순서다.
  const dayRows: RegularShuttleStop[] = stops
    .filter((s) => s.weekday === weekday && (s.direction === "BOARD" || s.direction === "ALIGHT") && s.studentName)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // 결석 매칭: 이름(+가능하면 학부모 전화)으로 그날 결석자와 이어 붙인다(best-effort) — 종전과 동일.
  const isAbsent = (p: { name: string | null; phone: string | null }) => matchAbsentee(p, absentees) !== null;

  // 요일·방향별 저장 노선. 테이블이 없거나 실패하면 null → 자동으로 폴백.
  const [savedPickup, savedDropoff] = await Promise.all(
    DIRECTIONS.map((d) => getSavedRegularDispatchRoute(dayOfWeek, d)),
  );
  const saved: Record<RouteDirection, { vehicles?: unknown } | null> = { PICKUP: savedPickup, DROPOFF: savedDropoff };

  // 저장 노선을 실제로 쓰는 방향에서만 매핑을 조회한다(폴백뿐이면 추가 쿼리 0).
  const orderIndex = new Map<string, number>();
  dayRows.forEach((r, i) => { if (r.id) orderIndex.set(r.id, i); });
  const empty = new Map<string, string[]>();
  const [mapPickup, mapDropoff] = await Promise.all(
    DIRECTIONS.map((d) =>
      pickRegularRouteSource(saved[d]) === "SAVED" ? loadRowIdsByStudentId(dayOfWeek, d, orderIndex) : Promise.resolve(empty),
    ),
  );

  const classes = assembleRegularDriverClasses({
    dayRows,
    isAbsent,
    saved,
    rowIdsByStudentId: { PICKUP: mapPickup, DROPOFF: mapDropoff },
  });

  // "오늘만" 셔틀 변경은 명단을 다 만든 뒤 덧붙인다. 저장 노선·폴백 두 경로 모두에
  // 똑같이 적용되어야 하는데, 조립 안에 심으면 한쪽만 고쳐지기 쉽다.
  // 결석과 같은 이름·전화 매칭을 쓴다(시트 명단에는 학생 id 가 없다).
  return attachShuttleDayNotes(
    classes,
    shuttleExceptions,
    (row, entry) => matchAbsentee(row, [{ name: entry.name, phone: entry.phone }]) !== null,
    describeException,
  );
}
