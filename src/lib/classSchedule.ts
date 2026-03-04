/**
 * classSchedule.ts
 *
 * 수업일자 계산 유틸리티.
 *
 * 두 가지 방식 지원:
 * A) 개강/종강 방식 (권장): "n월 개강" ~ "n월 종강" 사이의 수업 요일을 나열
 * B) n주차 방식 (fallback): "n월 n주차 시작" 이벤트 기반 주별 계산
 *
 * 두 방식 모두 "학원 휴무" 이벤트 날짜를 자동으로 제외함.
 */

// ─── Regex ───────────────────────────────────────────────────────────────────

/** "3월 1주차 시작", "10월 4주차 수업" 등 */
export const WEEK_START_RE = /(\d{1,2})월\s*(\d{1,2})주차/;

/** "3월 개강", "4월 개강일" 등 */
export const OPEN_RE = /(\d{1,2})월\s*개강/;

/** "3월 종강", "4월 종강일" 등 */
export const CLOSE_RE = /(\d{1,2})월\s*종강/;

/** "학원 휴무", "학원휴무", "휴무일", "휴강" 등 */
export const CLOSED_RE = /학원\s*휴무|휴무일|휴강/;

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Korean weekday names indexed by JS Date.getDay() */
export const DAY_NAMES: Record<number, string> = {
    0: "일", 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토",
};

/** YYYY-MM-DD 문자열 생성 */
function toISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 이벤트 제목의 "n월"과 실제 이벤트 날짜로 수강 연도+월을 파싱.
 * 이벤트가 "1월 1주차 시작"인데 12월에 열리면 academicYear = 이벤트 연도 + 1.
 */
export function parseAcademicYearMonth(
    title: string,
    re: RegExp,
    eventDate: Date,
): { academicYear: number; academicMonth: number } | null {
    const m = re.exec(title);
    if (!m) return null;

    const academicMonth = parseInt(m[1]) - 1; // 0-indexed
    const eventMonth    = eventDate.getMonth();
    const eventYear     = eventDate.getFullYear();
    const academicYear  = academicMonth < eventMonth ? eventYear + 1 : eventYear;

    return { academicYear, academicMonth };
}

// ─── 방식 A: 개강/종강 범위 기반 ──────────────────────────────────────────────

/**
 * 개강일~종강일 사이의 모든 수업 요일을 나열, 휴무일 제외.
 * 결과: { 요일(0-6): ["2026-03-30", "2026-04-06", ...] }
 */
export function computeClassDatesFromRange(
    startIso: string,
    endIso: string,
    classDays: number[],
    closedDateSet: Set<string>,
): Record<number, string[]> {
    const result: Record<number, string[]> = {};
    for (const d of classDays) result[d] = [];

    const cur = new Date(startIso + "T00:00:00");
    const end = new Date(endIso   + "T00:00:00");

    while (cur <= end) {
        const dow = cur.getDay();
        if (classDays.includes(dow)) {
            const iso = toISO(cur);
            if (!closedDateSet.has(iso)) result[dow].push(iso);
        }
        cur.setDate(cur.getDate() + 1);
    }

    return result;
}

// ─── 방식 B: n주차 시작 이벤트 기반 (fallback) ────────────────────────────────

function getWeekDates(
    weekStartDate: Date,
    classDays: number[],
): { day: number; isoDate: string }[] {
    const start = new Date(weekStartDate);
    start.setHours(0, 0, 0, 0);

    // 이벤트가 속한 주의 월요일 계산
    const dow      = start.getDay();
    const toMonday = dow === 0 ? -6 : 1 - dow;
    const weekMon  = new Date(start);
    weekMon.setDate(start.getDate() + toMonday);

    return classDays.map((classDay) => {
        const offset = classDay === 0 ? 6 : classDay - 1; // Mon=0 offset
        const d = new Date(weekMon);
        d.setDate(weekMon.getDate() + offset);
        return { day: classDay, isoDate: toISO(d) };
    });
}

/**
 * "n주차 시작" 이벤트 목록과 수업 요일로 월별 수업일자를 계산.
 * 휴무일(closedDateSet)은 제외.
 * 결과: { 요일(0-6): ["2026-03-09", "2026-03-16", ...] }
 */
export function getMonthClassSchedule(
    weekStartEvents: { date: string }[],
    classDays: number[],
    closedDateSet: Set<string> = new Set(),
): Record<number, string[]> {
    const schedule: Record<number, Set<string>> = {};
    for (const day of classDays) schedule[day] = new Set();

    for (const event of weekStartEvents) {
        for (const { day, isoDate } of getWeekDates(new Date(event.date), classDays)) {
            if (!closedDateSet.has(isoDate)) schedule[day]?.add(isoDate);
        }
    }

    const result: Record<number, string[]> = {};
    for (const day of classDays) result[day] = Array.from(schedule[day]).sort();
    return result;
}
