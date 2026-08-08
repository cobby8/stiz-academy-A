// 방학특강 출석 현황판을 "주간 달력"으로 배치하기 위한 순수 모듈.
// (prisma·react 등 어떤 의존성도 넣지 말 것 — 테스트가 이 파일만 직접 import 한다.)
//
// 왜 별도 파일인가: 어느 칸이 비고 어느 칸에 어떤 회차가 들어가는지는
// "날짜가 화면에서 사라지지 않는가"와 직결되는 계산이라, 화면과 분리해 테스트로 잠근다.

// 월요일 시작 — 원장이 보는 달력 순서와 같다.
export const CALENDAR_WEEKDAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type CalendarWeekdayKey = (typeof CALENDAR_WEEKDAY_ORDER)[number];

const WEEKDAY_KO: Record<string, string> = {
  MON: "월", TUE: "화", WED: "수", THU: "목", FRI: "금", SAT: "토", SUN: "일",
};

// 달력에 놓기 위해 최소한으로 필요한 정보. (실제 회차 객체는 이 타입을 만족하는 어떤 값이든 된다)
export type CalendarDateLike = {
  ymd?: string | null;
  weekdayKey?: string | null;
};

export type CalendarColumn = { key: CalendarWeekdayKey; label: string };
export type CalendarWeek<T> = { weekStart: string; cells: (T | null)[] };
export type SeasonalAttendanceCalendar<T> = {
  columns: CalendarColumn[];          // 수업이 있는 요일만 (예: 월·수 → 2열)
  weeks: CalendarWeek<T>[];           // 주차별 행. 수업 없는 칸은 null(빈 칸)
  multiMonth: boolean;                // 두 달 이상 걸치면 셀에 "7/27"처럼 월을 함께 보여준다
  unplaced: T[];                      // 날짜(ymd)가 이상해 달력에 못 놓은 회차 — 절대 버리지 않는다
};

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// 'YYYY-MM-DD' 를 UTC 기준 정오로 해석한다. (시간대 보정 없이 '달력 날짜'만 다루기 위함)
function toUtcDate(ymd: string): Date | null {
  const m = YMD_RE.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12));
  // 2월 30일 같은 값이 다른 날짜로 굴러가는 것을 막는다.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function toYmd(d: Date) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

// 'YYYY-MM-DD' → 요일 키. 값이 이상하면 null.
export function weekdayKeyFromYmd(ymd: string): CalendarWeekdayKey | null {
  const dt = toUtcDate(ymd);
  if (!dt) return null;
  // getUTCDay(): 0=일 … 6=토 → 월요일 시작 인덱스로 변환
  return CALENDAR_WEEKDAY_ORDER[(dt.getUTCDay() + 6) % 7];
}

// 그 날짜가 속한 주의 월요일. 주차 행을 묶는 열쇠다.
export function weekStartOf(ymd: string): string | null {
  const dt = toUtcDate(ymd);
  if (!dt) return null;
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return toYmd(dt);
}

function normalizeWeekdayKey(value: unknown): CalendarWeekdayKey | null {
  const key = String(value ?? "").trim().toUpperCase();
  return (CALENDAR_WEEKDAY_ORDER as readonly string[]).includes(key) ? (key as CalendarWeekdayKey) : null;
}

/**
 * 회차 목록을 주간 달력(가로=요일, 세로=주차)으로 배치한다.
 * - 열은 실제 수업이 있는 요일만 만든다(월·수만 하는 반이면 2열).
 * - 그 주에 수업이 없는 요일은 null(빈 칸)로 둬서 공휴일 등으로 빠진 날이 눈에 보이게 한다.
 * - 같은 주·같은 요일에 회차가 둘이면 행을 하나 더 만든다(회차가 사라지면 안 되므로).
 */
export function buildAttendanceCalendar<T extends CalendarDateLike>(dates: T[]): SeasonalAttendanceCalendar<T> {
  const list = Array.isArray(dates) ? dates : [];
  const placeable: { item: T; ymd: string; key: CalendarWeekdayKey; weekStart: string }[] = [];
  const unplaced: T[] = [];

  for (const item of list) {
    const ymd = String(item?.ymd ?? "");
    const weekStart = weekStartOf(ymd);
    // 요일은 서버가 준 값을 우선 쓰고(KST 기준), 없거나 이상하면 날짜에서 직접 뽑는다.
    const key = normalizeWeekdayKey(item?.weekdayKey) ?? weekdayKeyFromYmd(ymd);
    if (!weekStart || !key) { unplaced.push(item); continue; }
    placeable.push({ item, ymd, key, weekStart });
  }

  // 날짜 오름차순 — 원장이 보는 순서(1일차 → 마지막 날)와 같게 한다.
  placeable.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0));

  const usedKeys = new Set(placeable.map((p) => p.key));
  const columns: CalendarColumn[] = CALENDAR_WEEKDAY_ORDER
    .filter((k) => usedKeys.has(k))
    .map((k) => ({ key: k, label: WEEKDAY_KO[k] }));
  const colIndex = new Map(columns.map((c, i) => [c.key, i]));

  const rowsByWeek = new Map<string, (T | null)[][]>();
  for (const p of placeable) {
    const idx = colIndex.get(p.key);
    if (idx == null) continue; // 위에서 열을 만들었으므로 실제로는 일어나지 않는다
    let rows = rowsByWeek.get(p.weekStart);
    if (!rows) { rows = []; rowsByWeek.set(p.weekStart, rows); }
    // 이미 찬 칸이면 같은 주에 행을 하나 더 만들어 회차를 잃지 않는다.
    let row = rows.find((r) => r[idx] == null);
    if (!row) { row = new Array(columns.length).fill(null); rows.push(row); }
    row[idx] = p.item;
  }

  const weeks: CalendarWeek<T>[] = [];
  for (const weekStart of [...rowsByWeek.keys()].sort()) {
    for (const cells of rowsByWeek.get(weekStart)!) weeks.push({ weekStart, cells });
  }

  const months = new Set(placeable.map((p) => p.ymd.slice(0, 7)));
  return { columns, weeks, multiMonth: months.size > 1, unplaced };
}

// 셀에 찍을 짧은 날짜 라벨. 한 달 안이면 "27", 두 달 이상 걸치면 "7/27".
export function calendarCellDateLabel(ymd: string, multiMonth: boolean): string {
  const m = YMD_RE.exec(String(ymd ?? ""));
  if (!m) return String(ymd ?? "");
  const month = Number(m[2]), day = Number(m[3]);
  return multiMonth ? `${month}/${day}` : String(day);
}
