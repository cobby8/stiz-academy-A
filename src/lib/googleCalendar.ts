import ical from "node-ical";

export interface GoogleCalendarEvent {
    id: string;
    title: string;
    date: Date;
    endDate?: Date;
    description?: string;
    category: string;
    isAllDay: boolean;
    url?: string;
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

/**
 * node-ical은 VALUE=DATE 종일 이벤트를 "로컬 자정" Date로 파싱합니다.
 * 서버가 KST(UTC+9)이면 "2026-03-03T00:00:00+09:00" = "2026-03-02T15:00:00Z"가 되어
 * toISOString()으로 변환 시 하루 앞당겨지는 버그가 발생합니다.
 *
 * 이 함수는 로컬 날짜 성분(getFullYear/Month/Date)을 그대로 읽어
 * UTC 자정 Date로 정규화합니다. 어떤 서버 시간대에서도 올바른 날짜를 보장합니다.
 */
function normalizeAllDayDate(d: Date): Date {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export async function fetchGoogleCalendarEvents(icsUrl: string): Promise<GoogleCalendarEvent[]> {
    try {
        // node-ical.async.fromURL은 HTTP 캐시를 제어할 수 없으므로
        // fetch로 ICS 텍스트를 직접 가져온 후 동기 파서로 처리
        const res = await fetch(icsUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`ICS fetch failed: ${res.status}`);
        const icsText = await res.text();
        const events = ical.sync.parseICS(icsText) as Record<string, any>;
        const result: GoogleCalendarEvent[] = [];

        for (const key in events) {
            const event = events[key] as any;
            if (event.type !== "VEVENT") continue;

            const summary = event.summary || "제목 없음";
            const start = event.start;
            const end = event.end;
            if (!start) continue;

            // 반복 이벤트의 경우 rrule이 있으면 건너뜀 (복잡도 방지)
            if ((event as any).rrule) continue;

            // 종일 여부: datetype이 'date'이면 종일 이벤트
            const isAllDay = (event as any).datetype === "date";

            // 종일 이벤트는 로컬 날짜를 UTC 자정으로 정규화 (시간대 버그 방지)
            const startDate = isAllDay ? normalizeAllDayDate(new Date(start)) : new Date(start);

            let endDate: Date | undefined;
            if (end) {
                if (isAllDay) {
                    // ICS 종일 이벤트의 DTEND는 실제 마지막 날 + 1일 (exclusive)
                    // 예: 3월 5~7일 종일 → DTEND = 3월 8일 → 표시는 3월 7일까지
                    const raw = new Date(end);
                    raw.setDate(raw.getDate() - 1); // exclusive → inclusive
                    const adjusted = normalizeAllDayDate(raw);
                    // 시작일과 같으면 단일 종일 이벤트 → endDate 표시 안 함
                    if (adjusted.getTime() !== startDate.getTime()) {
                        endDate = adjusted;
                    }
                } else {
                    endDate = new Date(end);
                }
            }

            result.push({
                id: `gcal-${key}`,
                title: summary,
                date: startDate,
                endDate,
                description: event.description,
                category: inferCategory(summary, event.description),
                isAllDay,
                url: (event as any).url || undefined,
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
