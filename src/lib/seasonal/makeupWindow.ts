import { addDaysKst, kstAt, kstDow, todayKst } from "@/lib/datetime/kst";

// 방학특강 보강 후보 날짜 규칙. DB 에 붙지 않은 순수 모듈이라 실제로 실행해 검증한다.
// 날짜·시간대 계산은 직접 하지 않고 전부 @/lib/datetime/kst 를 거친다(함정 설명은 그 파일에).
//
// ■ 시작점은 "결석일"이 아니라 "지금"이다
//   결석을 미리 고지받는 경우가 있다(예: 8/20 결석을 8/12 에 신고). 결석일부터 세면
//   오늘~결석일 사이가 통째로 사라져 미리 잡아둘 수 있는 자리를 못 쓴다.
//   반대로 지난 결석을 뒤늦게 처리할 때 **이미 지나간 날**이 후보로 뜨던 문제도 함께 사라진다.
// ■ 끝점은 약관대로 결석일 기준 2개월.
// ■ 이미 시작한 수업은 뺀다 — 배정해도 학생이 갈 수 없다.

export const MAKEUP_WINDOW_DAYS = 60;

/**
 * 그 날 수업이 이미 시작했는가.
 * 시작 시각을 못 읽으면 false — 있는 선택지를 숨기는 쪽이 더 나쁘다(원장이 보고 판단한다).
 */
export function classAlreadyStarted(ymd: string, startTime: unknown, nowMs: number): boolean {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(startTime ?? ""));
  if (!m) return false;
  const at = kstAt(ymd, `${m[1]}:${m[2]}`);
  return Number.isFinite(at) && at <= nowMs;
}

/**
 * 정규수업 보강 후보일 — 오늘부터 보강 기한까지 중 그 반 요일에 해당하는 첫 날.
 * 오늘이 그 요일이어도 수업이 이미 시작했으면 다음 주로 넘긴다.
 * 기한(windowEndMs) 안에 해당 요일이 없으면 null.
 */
export function findNextClassDate(input: {
  dayOfWeek: number | null;
  startTime?: unknown;
  nowMs: number;
  windowEndMs: number;
}): string | null {
  const { dayOfWeek, startTime, nowMs, windowEndMs } = input;
  if (dayOfWeek == null || !Number.isFinite(dayOfWeek)) return null;
  const target = ((dayOfWeek % 7) + 7) % 7;
  const todayYmd = todayKst(nowMs);
  let ymd = todayYmd;
  // 요일 하나를 찾는 데는 7일이면 충분하지만, 기한 검사가 실제 상한이다.
  for (let i = 0; i <= MAKEUP_WINDOW_DAYS + 7; i++) {
    if (kstAt(ymd) > windowEndMs) return null;
    if (kstDow(ymd) === target && !(ymd === todayYmd && classAlreadyStarted(ymd, startTime, nowMs))) {
      return ymd;
    }
    ymd = addDaysKst(ymd, 1);
  }
  return null;
}
