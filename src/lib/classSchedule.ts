/**
 * classSchedule.ts
 *
 * Utilities for calculating class dates from "n월 n주차 시작" calendar events.
 *
 * Logic:
 *  1. The event title is matched against WEEK_START_RE to identify week-start markers.
 *  2. The event's date is treated as the beginning of that class week.
 *  3. For each configured class day (0=Sun … 6=Sat), we find the nearest
 *     occurrence of that weekday on or after the event date within the same 7-day window.
 *  4. Aggregating across all "n주차 시작" events in a month gives the full
 *     monthly class schedule grouped by weekday.
 */

/** Matches titles like "1월 1주차 시작", "3월 2주차", "10월 4주차 수업" */
export const WEEK_START_RE = /(\d{1,2})월\s*(\d{1})주차/;

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
 * Given a week-start date and configured class days, returns each class day's
 * calendar date within the 7-day window starting from weekStartDate.
 *
 * Example: weekStartDate = 2025-01-05 (Sun), classDays = [1, 3]
 *   → [{ day: 1, date: 6 }, { day: 3, date: 8 }]  (Mon 6th, Wed 8th)
 */
function getWeekDates(
    weekStartDate: Date,
    classDays: number[],
): { day: number; date: number }[] {
    const start = new Date(weekStartDate);
    start.setHours(0, 0, 0, 0);
    const startDow = start.getDay(); // 0–6

    return classDays.map((classDay) => {
        let diff = classDay - startDow;
        if (diff < 0) diff += 7; // wrap to next week if needed
        const d = new Date(start);
        d.setDate(start.getDate() + diff);
        return { day: classDay, date: d.getDate() };
    });
}

/**
 * Given all "n주차 시작" events in a month (as objects with a `date` ISO string)
 * and the configured class days, returns a map of weekday → sorted date numbers.
 *
 * Example result: { 1: [6, 13, 20, 27], 3: [8, 15, 22, 29] }
 *   → 월요일 수업: 6, 13, 20, 27일 / 수요일 수업: 8, 15, 22, 29일
 *
 * Months with fewer than 4 weeks (e.g. Feb with Lunar New Year) are handled
 * automatically — only events actually present in the calendar are counted.
 */
export function getMonthClassSchedule(
    weekStartEvents: { date: string }[],
    classDays: number[],
): Record<number, number[]> {
    const schedule: Record<number, Set<number>> = {};
    for (const day of classDays) {
        schedule[day] = new Set();
    }

    for (const event of weekStartEvents) {
        const weekDates = getWeekDates(new Date(event.date), classDays);
        for (const { day, date } of weekDates) {
            schedule[day]?.add(date);
        }
    }

    const result: Record<number, number[]> = {};
    for (const day of classDays) {
        result[day] = Array.from(schedule[day]).sort((a, b) => a - b);
    }
    return result;
}
