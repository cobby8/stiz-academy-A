import { getAnnualEvents, getAcademySettings } from "@/app/actions/admin";
import { fetchGoogleCalendarEvents } from "@/lib/googleCalendar";
import PublicPageLayout from "@/components/PublicPageLayout";

export const revalidate = 3600; // 1시간마다 구글 캘린더 재조회

export const metadata = { title: "연간일정표 | STIZ 농구교실 다산점" };

const CATEGORY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
    대회: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
    방학: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
    특별행사: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
    정기행사: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
    일반: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400" },
};

const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function formatDate(date: Date): string {
    const d = new Date(date);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default async function AnnualPage() {
    const [dbEvents, settings] = await Promise.all([
        getAnnualEvents() as Promise<any[]>,
        getAcademySettings() as Promise<any>,
    ]);

    const phone = settings.contactPhone || "010-0000-0000";
    const icsUrl = settings.googleCalendarIcsUrl as string | null;

    // 구글 캘린더 이벤트 fetch (ICS URL이 설정된 경우)
    const googleEvents = icsUrl ? await fetchGoogleCalendarEvents(icsUrl) : [];

    // DB 이벤트 + 구글 캘린더 이벤트 합산 후 날짜순 정렬
    const allEvents = [
        ...dbEvents.map((e: any) => ({ ...e, source: "db" })),
        ...googleEvents,
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 월별 그룹핑
    const eventsByMonth: Record<number, any[]> = {};
    allEvents.forEach((event) => {
        const month = new Date(event.date).getMonth();
        if (!eventsByMonth[month]) eventsByMonth[month] = [];
        eventsByMonth[month].push(event);
    });

    const activeMonths = Object.keys(eventsByMonth).map(Number).sort((a, b) => a - b);
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
                    <div className="flex flex-wrap gap-3 items-center justify-between">
                        <div className="flex flex-wrap gap-3 items-center">
                            <span className="text-sm font-bold text-gray-500 mr-1">구분:</span>
                            {categories.map((cat) => (
                                <div key={cat} className="flex items-center gap-1.5">
                                    <span className={`w-3 h-3 rounded-full ${CATEGORY_STYLES[cat].dot}`}></span>
                                    <span className="text-sm text-gray-700">{cat}</span>
                                </div>
                            ))}
                        </div>
                        {icsUrl && googleEvents.length > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.89 3 3 3.9 3 5v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm0 16H5V8h14v11z"/></svg>
                                구글 캘린더 연동 중 ({googleEvents.length}개)
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Events List */}
            <section className="py-14 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4">
                    {allEvents.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 text-gray-400">
                            <div className="text-5xl mb-4">📅</div>
                            <p className="text-lg font-medium">등록된 일정이 없습니다.</p>
                            <p className="text-sm mt-2">관리자가 일정을 등록하면 여기에 표시됩니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {activeMonths.map((month) => (
                                <div key={month}>
                                    <h2 className="text-xl font-black text-brand-navy-900 mb-4 flex items-center gap-2">
                                        <span className="w-8 h-8 bg-brand-navy-900 text-white rounded-full flex items-center justify-center text-sm font-black">
                                            {month + 1}
                                        </span>
                                        {MONTH_NAMES[month]}
                                    </h2>
                                    <div className="space-y-3">
                                        {eventsByMonth[month].map((event) => {
                                            const catStyle = CATEGORY_STYLES[event.category] || CATEGORY_STYLES["일반"];
                                            return (
                                                <div
                                                    key={event.id}
                                                    className={`${catStyle.bg} rounded-xl p-4 border border-opacity-50 flex flex-col sm:flex-row sm:items-center gap-3`}
                                                >
                                                    <div className="shrink-0 text-center sm:text-left sm:min-w-[90px]">
                                                        <p className="font-black text-gray-900 text-sm">
                                                            {formatDate(event.date)}
                                                        </p>
                                                        {event.endDate && (
                                                            <p className="text-xs text-gray-500">
                                                                ~ {formatDate(event.endDate)}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                                            <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${catStyle.bg} ${catStyle.text} border`}>
                                                                <span className={`w-2 h-2 rounded-full ${catStyle.dot}`}></span>
                                                                {event.category || "일반"}
                                                            </span>
                                                            <h3 className="font-bold text-gray-900">{event.title}</h3>
                                                            {event.source === "google" && (
                                                                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.89 3 3 3.9 3 5v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm0 16H5V8h14v11z"/></svg>
                                                                    구글 캘린더
                                                                </span>
                                                            )}
                                                        </div>
                                                        {event.description && (
                                                            <p className="text-sm text-gray-600">{event.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

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
