import ical from "node-ical";

export interface GoogleCalendarEvent {
    id: string;
    title: string;
    date: Date;
    endDate?: Date;
    description?: string;
    category: string;
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

            result.push({
                id: `gcal-${key}`,
                title: summary,
                date: new Date(start),
                endDate: end ? new Date(end) : undefined,
                description: event.description,
                category: inferCategory(summary, event.description),
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
