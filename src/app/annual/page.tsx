import { getAnnualEvents, getAcademySettings } from "@/app/actions/admin";
import { fetchGoogleCalendarEvents } from "@/lib/googleCalendar";
import PublicPageLayout from "@/components/PublicPageLayout";
import AnnualEventsClient, { SerializedEvent } from "./AnnualEventsClient";

export const revalidate = 3600; // 1시간마다 구글 캘린더 재조회

export const metadata = { title: "연간일정표 | STIZ 농구교실 다산점" };

const CATEGORY_STYLES: Record<string, { dot: string }> = {
    대회: { dot: "bg-red-500" },
    방학: { dot: "bg-yellow-500" },
    특별행사: { dot: "bg-purple-500" },
    정기행사: { dot: "bg-blue-500" },
    일반: { dot: "bg-gray-400" },
};

export default async function AnnualPage() {
    const [dbEvents, settings] = await Promise.all([
        getAnnualEvents() as Promise<any[]>,
        getAcademySettings() as Promise<any>,
    ]);

    const phone = settings.contactPhone || "010-0000-0000";
    const icsUrl = settings.googleCalendarIcsUrl as string | null;

    // 구글 캘린더 이벤트 fetch
    const googleEvents = icsUrl ? await fetchGoogleCalendarEvents(icsUrl) : [];

    // 직렬화 (Date → ISO string) 후 클라이언트에 전달
    const allEvents: SerializedEvent[] = [
        ...dbEvents.map((e: any) => ({
            id: e.id,
            title: e.title,
            date: (e.date as Date).toISOString(),
            endDate: e.endDate ? (e.endDate as Date).toISOString() : undefined,
            description: e.description ?? undefined,
            category: e.category || "일반",
            isAllDay: true, // DB 이벤트는 종일 처리
            source: "db" as const,
        })),
        ...googleEvents.map((e) => ({
            id: e.id,
            title: e.title,
            date: e.date.toISOString(),
            endDate: e.endDate?.toISOString(),
            description: e.description,
            category: e.category,
            isAllDay: e.isAllDay,
            url: e.url,
            source: "google" as const,
        })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const categories = Object.keys(CATEGORY_STYLES);

    return (
        <PublicPageLayout>
            {/* Page Hero */}
            <div className="bg-brand-navy-900 text-white py-14">
                <div className="max-w-4xl mx-auto px-4">
                    <p className="text-brand-orange-500 text-sm font-bold uppercase mb-2">ANNUAL SCHEDULE</p>
                    <h1 className="text-4xl font-black mb-3">연간일정표</h1>
                    <p className="text-blue-200">대회, 방학, 특별 행사 일정을 확인하세요.</p>
                </div>
            </div>

            {/* Legend */}
            <section className="py-6 bg-white border-b border-gray-100">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <span className="text-sm font-bold text-gray-500 mr-1">구분:</span>
                        {categories.map((cat) => (
                            <div key={cat} className="flex items-center gap-1.5">
                                <span className={`w-3 h-3 rounded-full ${CATEGORY_STYLES[cat].dot}`}></span>
                                <span className="text-sm text-gray-700">{cat}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Events (Client Component - handles year filter) */}
            <AnnualEventsClient allEvents={allEvents} />

            {/* CTA */}
            <section className="bg-brand-navy-900 text-white py-14">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-2xl font-black mb-4">더 궁금한 점이 있으신가요?</h2>
                    <p className="text-blue-200 mb-6">일정에 대해 문의해 주시면 자세히 안내해 드립니다.</p>
                    <a
                        href={`tel:${phone.replace(/-/g, "")}`}
                        className="inline-block bg-brand-orange-500 hover:bg-orange-600 text-white font-black text-lg px-10 py-4 rounded-xl transition shadow-lg"
                    >
                        📞 {phone}
                    </a>
                </div>
            </section>
        </PublicPageLayout>
    );
}
