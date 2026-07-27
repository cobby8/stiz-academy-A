// 정규 수업 "사전 결석 신고"(#3 Step B)용 순수 로직.
// ⚠️ import 의존성 0 — 요일/날짜 계산과 사유 검증은 실수하기 쉬워 유닛 테스트로 고정한다.
// (방학특강 parentAbsenceRules 와 같은 역할이나, 정규는 "달력 날짜(YYYY-MM-DD)" 기준이다.)

// ── 결석 사유 5종(방학특강과 동일 집합) ────────────────────────────────────
export const VALID_REASONS = [
  "ILLNESS_INJURY",
  "PERSONAL",
  "FAMILY_TRIP",
  "SCHOOL_EVENT",
  "ETC",
] as const;

export type AbsenceReason = (typeof VALID_REASONS)[number];

export const REASON_LABEL: Record<string, string> = {
  ILLNESS_INJURY: "질병/부상",
  PERSONAL: "개인 사정",
  FAMILY_TRIP: "가족 여행",
  SCHOOL_EVENT: "학교 행사",
  ETC: "기타",
};

export function isValidReason(v: unknown): v is AbsenceReason {
  return typeof v === "string" && (VALID_REASONS as readonly string[]).includes(v);
}

// ── 요일 문자열("Mon" 등) ↔ 인덱스(0=일 ~ 6=토) ─────────────────────────────
// Class.dayOfWeek 는 "Mon","Tue"... 형식이다(enrollments.dayOfWeek 와 동일, summary.ts 참고).
export const DAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export const DAY_KO: string[] = ["일", "월", "화", "수", "목", "금", "토"];

// dayOfWeek 문자열 → 인덱스. 알 수 없으면 null.
export function dayIndexOf(dayOfWeek: string): number | null {
  const i = DAY_INDEX[dayOfWeek];
  return i == null ? null : i;
}

// ── 날짜(YYYY-MM-DD) 유틸 ─────────────────────────────────────────────────
// ⚠️ 타임존 영향을 없애려고 항상 UTC 자정으로 다뤄 순수·결정론적으로 계산한다.
//    (날짜만 다루므로 UTC 로 고정해도 요일/일수 계산은 정확하다.)
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYmd(v: unknown): v is string {
  return typeof v === "string" && YMD_RE.test(v);
}

// YYYY-MM-DD → 그 날짜의 요일 인덱스(0=일 ~ 6=토). 형식 오류면 null.
export function ymdToDayIndex(ymd: string): number | null {
  if (!isYmd(ymd)) return null;
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCDay();
}

// YYYY-MM-DD 에 n일을 더한 새 날짜 문자열.
export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// a > b (a가 b보다 미래)인지. 둘 다 YYYY-MM-DD.
export function isFutureYmd(a: string, todayYmd: string): boolean {
  if (!isYmd(a) || !isYmd(todayYmd)) return false;
  return a > todayYmd; // ISO 날짜 문자열은 사전순 = 날짜순
}

// ── 다가오는 수업일 계산 ──────────────────────────────────────────────────
// 오늘(todayYmd) "이후"의, 해당 요일에 맞는 날짜를 최대 weeks개 생성한다.
// 오늘이 마침 그 요일이어도 "오늘 이후"만 신고 대상이므로 오늘은 제외(다음 주부터).
export function computeUpcomingDates(
  todayYmd: string,
  dayOfWeek: string,
  weeks: number,
): string[] {
  if (!isYmd(todayYmd)) return [];
  const target = dayIndexOf(dayOfWeek);
  if (target == null) return [];
  const todayIdx = ymdToDayIndex(todayYmd);
  if (todayIdx == null) return [];

  // 오늘로부터 그 요일까지의 일수. 오늘(delta=0)은 제외하고 다음 주로 밀어 항상 미래로.
  let delta = (target - todayIdx + 7) % 7;
  if (delta === 0) delta = 7;

  const first = addDaysYmd(todayYmd, delta);
  const out: string[] = [];
  for (let i = 0; i < Math.max(0, weeks); i++) {
    out.push(addDaysYmd(first, i * 7));
  }
  return out;
}

// 신고 가능한 (미래 + 요일 일치) 날짜인지 서버에서 재검증하는 헬퍼.
export function isReportableDate(ymd: string, dayOfWeek: string, todayYmd: string): boolean {
  if (!isFutureYmd(ymd, todayYmd)) return false;
  const target = dayIndexOf(dayOfWeek);
  const actual = ymdToDayIndex(ymd);
  return target != null && actual != null && target === actual;
}
