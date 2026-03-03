import ical from "node-ical";

export interface GoogleCalendarEvent {
    id: string;
    title: string;
    date: Date;
    endDate?: Date;
    description?: string;
    category: string;
    isAllDay: boolean;
    source: "google";
}

// 구글 캘린더 이벤트 제목에서 카테고리 추론
function inferCategory(summary: string, description?: string): string {
    const text = `${summary} ${description || ""}`.toLowerCase();
    if (text.includes("대회") || text.includes("경기") || text.includes("tournament")) return "대회";
    if (text.includes("방학") || text.includes("휴강") || text.includes("vacation")) return "방학";
    if (text.includes("특별") || text.includes("행사") || text.includes("event")) return "특별행사";
    if (text.includes("정기") || text.includes("정례")) return "정기행사";
    return "일반";
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
}

export async function fetchGoogleCalendarEvents(icsUrl: string): Promise<GoogleCalendarEvent[]> {
    try {
        const events = await ical.async.fromURL(icsUrl);
        const result: GoogleCalendarEvent[] = [];

        for (const key in events) {
            const event = events[key];
            if (event.type !== "VEVENT") continue;

            const summary = event.summary || "제목 없음";
            const start = event.start;
            const end = event.end;
            if (!start) continue;

            // 반복 이벤트의 경우 rrule이 있으면 건너뜀 (복잡도 방지)
            if ((event as any).rrule) continue;

            // 종일 여부: datetype이 'date'이면 종일 이벤트
            const isAllDay = (event as any).datetype === "date";

            let endDate: Date | undefined;
            if (end) {
                if (isAllDay) {
                    // ICS 종일 이벤트의 DTEND는 실제 마지막 날 + 1일 (exclusive)
                    // 예: 3월 5일 종일 → DTEND = 3월 6일
                    // 예: 3월 5~7일 종일 → DTEND = 3월 8일
                    const endAdjusted = new Date(end);
                    endAdjusted.setDate(endAdjusted.getDate() - 1);
                    // 조정된 endDate가 startDate와 같으면 단일 종일 이벤트 → endDate 표시 안 함
                    if (!isSameDay(endAdjusted, new Date(start))) {
                        endDate = endAdjusted;
                    }
                } else {
                    endDate = new Date(end);
                }
            }

            result.push({
                id: `gcal-${key}`,
                title: summary,
                date: new Date(start),
                endDate,
                description: event.description,
                category: inferCategory(summary, event.description),
                isAllDay,
                source: "google",
            });
        }

        // 날짜순 정렬
        return result.sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch (e) {
        console.error("Failed to fetch Google Calendar ICS:", e);
        return [];
    }
}
