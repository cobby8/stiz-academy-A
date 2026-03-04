import { getAnnualEvents, getAcademySettings, getClasses } from "@/app/actions/admin";
import { fetchGoogleCalendarEvents } from "@/lib/googleCalendar";
import { getMonthClassSchedule, WEEK_START_RE } from "@/lib/classSchedule";
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

// Class.dayOfWeek("Mon","Tue"…) → JS getDay() 숫자
const DOW_MAP: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };

export default async function AnnualPage() {
    const [dbEvents, settings, classes] = await Promise.all([
        getAnnualEvents() as Promise<any[]>,
        getAcademySettings() as Promise<any>,
        getClasses() as Promise<any[]>,
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
            isAllDay: true,
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

    // ── 서버에서 월별 수업일자 계산 ──────────────────────────────────
    // 1. Class 레코드에서 수업 요일(숫자) 도출
    const rawDayOfWeeks = classes.map((c: any) => c.dayOfWeek);
    console.log("[annual] classes.length:", classes.length, "| dayOfWeeks:", rawDayOfWeeks);

    const classDays: number[] = [
        ...new Set(
            classes
                .map((c: any) => DOW_MAP[c.dayOfWeek])
                .filter((n: number | undefined) => n !== undefined)
        ),
    ].sort((a, b) => a - b);

    console.log("[annual] classDays:", classDays);

    // 2. 구글 캘린더의 "n월 n주차 시작" 이벤트를 월별로 그룹핑
    // monthSchedules: { 월(0-11): { 요일(0-6): [날짜, ...] } }
    const monthSchedules: Record<number, Record<number, number[]>> = {};

    if (classDays.length > 0) {
        // 월별로 week-start 이벤트 수집
        const weekStartsByMonth: Record<number, { date: string }[]> = {};
        for (const ev of allEvents) {
            if (!WEEK_START_RE.test(ev.title)) continue;
            const mon = new Date(ev.date).getMonth(); // 0-11
            if (!weekStartsByMonth[mon]) weekStartsByMonth[mon] = [];
            weekStartsByMonth[mon].push({ date: ev.date });
        }

        // 월별로 수업일자 계산
        for (const [monStr, weekStarts] of Object.entries(weekStartsByMonth)) {
            const mon = Number(monStr);
            monthSchedules[mon] = getMonthClassSchedule(weekStarts, classDays);
        }
    }

    // 주차 시작 이벤트 찾기 디버그
    const weekStartTitles = allEvents.filter(e => WEEK_START_RE.test(e.title)).map(e => e.title);
    console.log("[annual] weekStart events found:", weekStartTitles.length, weekStartTitles.slice(0, 5));
    console.log("[annual] monthSchedules keys:", Object.keys(monthSchedules));

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

            {/* 임시 디버그 패널 - 확인 후 삭제 */}
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-900 text-xs font-mono p-3 mx-4 mt-4 rounded">
                <b>[DEBUG]</b> classes: {classes.length}개 | classDays: [{classDays.join(",")}] | monthSchedules keys: [{Object.keys(monthSchedules).join(",")}] | weekStart events: {allEvents.filter(e => WEEK_START_RE.test(e.title)).length}개
            </div>

            {/* Events (Client Component - handles year filter, schedule toggle) */}
            <AnnualEventsClient
                allEvents={allEvents}
                classDays={classDays}
                monthSchedules={monthSchedules}
            />

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
