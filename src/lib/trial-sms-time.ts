const SEOUL_TIME_ZONE = "Asia/Seoul";

const trialSmsDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

/**
 * 체험 일정 문자는 서버의 실행 지역과 관계없이 한국 학원 시간으로 표시한다.
 */
export function formatTrialSmsDateTime(value: Date | string | null | undefined): string {
    if (!value) return "";

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const parts = Object.fromEntries(
        trialSmsDateTimeFormatter
            .formatToParts(date)
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value]),
    );

    return `${parts.year}년 ${parts.month}월 ${parts.day}일 (${parts.weekday}) ${parts.hour}:${parts.minute}`;
}
