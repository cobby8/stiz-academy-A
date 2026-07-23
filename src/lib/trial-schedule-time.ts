export interface TrialScheduleTimeCandidate {
    startTime: string;
    scheduleStartTime?: string | null;
    scheduleActiveFrom?: string | Date | null;
    scheduleActiveTo?: string | Date | null;
    startTimeOverride?: string | null;
    customStartTime?: string | null;
}

const SEOUL_TIME_ZONE = "Asia/Seoul";

function seoulDateParts(value: string | Date) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: SEOUL_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
}

export function seoulDateInputValue(value: string | Date | null) {
    return value ? seoulDateParts(value) ?? "" : "";
}

export function seoulTimeInputValue(value: string | Date | null) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: SEOUL_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("hour")}:${part("minute")}`;
}

function isScheduleActiveOnDate(candidate: TrialScheduleTimeCandidate, selectedDate: string) {
    const activeFrom = candidate.scheduleActiveFrom ? seoulDateParts(candidate.scheduleActiveFrom) : null;
    const activeTo = candidate.scheduleActiveTo ? seoulDateParts(candidate.scheduleActiveTo) : null;
    return (!activeFrom || selectedDate >= activeFrom) && (!activeTo || selectedDate <= activeTo);
}

export function resolveTrialScheduleStartTime(
    candidate: TrialScheduleTimeCandidate | null | undefined,
    selectedDate: string,
) {
    if (!candidate) return "";
    if (candidate.startTimeOverride) return candidate.startTimeOverride;
    if (candidate.scheduleStartTime && selectedDate && isScheduleActiveOnDate(candidate, selectedDate)) {
        return candidate.scheduleStartTime;
    }
    return candidate.customStartTime || candidate.startTime || "";
}

export function toSeoulScheduledDateTime(selectedDate: string, selectedTime: string) {
    const normalizedTime = /^\d{2}:\d{2}$/.test(selectedTime) ? `${selectedTime}:00` : selectedTime;
    const value = `${selectedDate}T${normalizedTime}+09:00`;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : value;
}
