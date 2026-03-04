/**
 * classSchedule.ts
 *
 * Utilities for calculating class dates from "n월 n주차 시작" calendar events.
 *
 * Key principle: The "n월" in the event title defines the ACADEMIC month,
 * regardless of what calendar date the event actually falls on.
 * (e.g. "4월 1주차 시작" on March 31 → that week belongs to April's schedule)
 */

/** Matches titles like "1월 1주차 시작", "3월 2주차", "10월 4주차 수업" */
export const WEEK_START_RE = /(\d{1,2})월\s*(\d{1,2})주차/;

/** Korean weekday names indexed by JS Date.getDay() (0 = 일, 1 = 월, …, 6 = 토) */
export const DAY_NAMES: Record<number, string> = {
    0: "일",
    1: "월",
    2: "화",
    3: "수",
    4: "목",
    5: "금",
    6: "토",
};

/**
 * Parse the academic month (0-indexed) and event year from a week-start event.
 * Academic year = event's calendar year, except when academic month < event month
 * (e.g. "1월 1주차" on December 28 → academic year = event year + 1).
 */
export function parseAcademicYearMonth(
    title: string,
    eventDate: Date,
): { academicYear: number; academicMonth: number } | null {
    const m = WEEK_START_RE.exec(title);
    if (!m) return null;

    const academicMonth = parseInt(m[1]) - 1; // 0-indexed (0=Jan)
    const eventMonth    = eventDate.getMonth();
    const eventYear     = eventDate.getFullYear();

    // If the academic month is earlier in the year than the event month,
    // the event belongs to the next calendar year's academic period.
    const academicYear = academicMonth < eventMonth ? eventYear + 1 : eventYear;

    return { academicYear, academicMonth };
}

/**
 * Given a week-start event date and configured class days, returns each class day's
 * full ISO date (YYYY-MM-DD) within the same Mon–Sun week as the event.
 *
 * Example: weekStartDate = 2026-03-31 (Tue), classDays = [1, 2]
 *   → [{ day: 1, isoDate: "2026-03-30" }, { day: 2, isoDate: "2026-03-31" }]
 */
function getWeekDates(
    weekStartDate: Date,
    classDays: number[],
): { day: number; isoDate: string }[] {
    const start = new Date(weekStartDate);
    start.setHours(0, 0, 0, 0);

    // Find the Monday of this week (Mon = first day of week)
    const dow = start.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const toMonday = dow === 0 ? -6 : 1 - dow;
    const weekMonday = new Date(start);
    weekMonday.setDate(start.getDate() + toMonday);

    return classDays.map((classDay) => {
        // Offset from Monday: Mon=0, Tue=1, ..., Sat=5, Sun=6
        const offset = classDay === 0 ? 6 : classDay - 1;
        const d = new Date(weekMonday);
        d.setDate(weekMonday.getDate() + offset);

        const yyyy = d.getFullYear();
        const mm   = String(d.getMonth() + 1).padStart(2, "0");
        const dd   = String(d.getDate()).padStart(2, "0");
        return { day: classDay, isoDate: `${yyyy}-${mm}-${dd}` };
    });
}

/**
 * Given all "n주차 시작" events in one academic month (as objects with a `date` ISO string)
 * and the configured class days, returns a map of weekday → sorted ISO date strings.
 *
 * Example result: { 1: ["2026-04-06","2026-04-13","2026-04-20","2026-03-30"],
 *                   2: ["2026-03-31","2026-04-07","2026-04-14","2026-04-21"] }
 */
export function getMonthClassSchedule(
    weekStartEvents: { date: string }[],
    classDays: number[],
): Record<number, string[]> {
    const schedule: Record<number, Set<string>> = {};
    for (const day of classDays) {
        schedule[day] = new Set();
    }

    for (const event of weekStartEvents) {
        const weekDates = getWeekDates(new Date(event.date), classDays);
        for (const { day, isoDate } of weekDates) {
            schedule[day]?.add(isoDate);
        }
    }

    const result: Record<number, string[]> = {};
    for (const day of classDays) {
        result[day] = Array.from(schedule[day]).sort();
    }
    return result;
}
