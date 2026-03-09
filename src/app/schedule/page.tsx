import { getClasses, getAcademySettings } from "@/lib/queries";
import PublicPageLayout from "@/components/PublicPageLayout";

export const revalidate = 60;
export const metadata = { title: "수업시간표 | STIZ 농구교실 다산점" };

const DAYS = [
    { value: "Mon", label: "월요일" },
    { value: "Tue", label: "화요일" },
    { value: "Wed", label: "수요일" },
    { value: "Thu", label: "목요일" },
    { value: "Fri", label: "금요일" },
    { value: "Sat", label: "토요일" },
    { value: "Sun", label: "일요일" },
];

const DAY_COLORS: Record<string, string> = {
    Mon: "bg-blue-50 border-blue-200",
    Tue: "bg-green-50 border-green-200",
    Wed: "bg-yellow-50 border-yellow-200",
    Thu: "bg-purple-50 border-purple-200",
    Fri: "bg-red-50 border-red-200",
    Sat: "bg-orange-50 border-orange-200",
    Sun: "bg-gray-50 border-gray-200",
};

const DAY_BADGE: Record<string, string> = {
    Mon: "bg-blue-600",
    Tue: "bg-green-600",
    Wed: "bg-yellow-500",
    Thu: "bg-purple-600",
    Fri: "bg-red-600",
    Sat: "bg-brand-orange-500",
    Sun: "bg-gray-500",
};

export default async function SchedulePage() {
    const [classes, settings] = await Promise.all([
        getClasses(),
        getAcademySettings() as Promise<any>,
    ]);
    const phone = settings.contactPhone || "010-0000-0000";

    // Group classes by day of week
    const classesByDay = DAYS.reduce((acc, day) => {
        acc[day.value] = classes.filter((c: any) => c.dayOfWeek === day.value)
            .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
        return acc;
    }, {} as Record<string, any[]>);

    const activeDays = DAYS.filter((day) => classesByDay[day.value].length > 0);

    return (
        <PublicPageLayout>
            {/* Page Hero */}
            <div className="bg-brand-navy-900 text-white py-14">
                <div className="max-w-4xl mx-auto px-4">
                    <p className="text-brand-orange-500 text-sm font-bold uppercase mb-2">SCHEDULE</p>
                    <h1 className="text-4xl font-black mb-3">수업시간표</h1>
                    <p className="text-blue-200">요일별 수업 시간을 확인하세요.</p>
                </div>
            </div>

            {/* Schedule Grid */}
            <section className="py-14 bg-gray-50">
                <div className="max-w-5xl mx-auto px-4">
                    {classes.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-200">
                            <div className="text-5xl mb-4">📅</div>
                            <p className="text-lg font-medium">시간표를 준비 중입니다.</p>
                            <p className="text-sm mt-2">문의: {phone}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {activeDays.map((day) => (
                                <div key={day.value} className={`rounded-2xl border ${DAY_COLORS[day.value]} overflow-hidden`}>
                                    <div className={`${DAY_BADGE[day.value]} text-white px-5 py-3 flex items-center gap-3`}>
                                        <span className="font-black text-lg">{day.label}</span>
                                        <span className="text-white/70 text-sm font-medium">
                                            {classesByDay[day.value].length}개 클래스
                                        </span>
                                    </div>
                                    <div className="p-4">
                                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {classesByDay[day.value].map((cls: any) => (
                                                <div key={cls.id} className="bg-white rounded-xl p-4 shadow-sm border border-white/80">
                                                    <h4 className="font-bold text-gray-900 mb-1">{cls.name}</h4>
                                                    {cls.program?.name && (
                                                        <p className="text-xs text-brand-orange-500 font-bold mb-2">{cls.program.name}</p>
                                                    )}
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <span>⏰</span>
                                                        <span className="font-medium">{cls.startTime} ~ {cls.endTime}</span>
                                                    </div>
                                                    {cls.location && (
                                                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                                            <span>📍</span>
                                                            <span>{cls.location}</span>
                                                        </div>
                                                    )}
                                                    {cls.capacity && (
                                                        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
                                                            정원 {cls.capacity}명
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* All classes table (alternate view) */}
            {classes.length > 0 && (
                <section className="py-14 bg-white">
                    <div className="max-w-5xl mx-auto px-4">
                        <h2 className="text-2xl font-black text-brand-navy-900 mb-8 text-center">전체 시간표 (표 보기)</h2>
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-brand-navy-900 text-white">
                                        <tr>
                                            <th className="px-5 py-4 text-left font-bold">클래스명</th>
                                            <th className="px-5 py-4 text-left font-bold">프로그램</th>
                                            <th className="px-5 py-4 text-left font-bold">요일</th>
                                            <th className="px-5 py-4 text-left font-bold">시간</th>
                                            <th className="px-5 py-4 text-left font-bold">장소</th>
                                            <th className="px-5 py-4 text-center font-bold">정원</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {[...classes]
                                            .sort((a: any, b: any) => {
                                                const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                                                const da = dayOrder.indexOf(a.dayOfWeek);
                                                const db = dayOrder.indexOf(b.dayOfWeek);
                                                if (da !== db) return da - db;
                                                return a.startTime.localeCompare(b.startTime);
                                            })
                                            .map((cls: any) => (
                                                <tr key={cls.id} className="hover:bg-gray-50">
                                                    <td className="px-5 py-3.5 font-medium text-gray-900">{cls.name}</td>
                                                    <td className="px-5 py-3.5 text-gray-600">{cls.program?.name || "-"}</td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`inline-block text-white text-xs font-bold px-2 py-0.5 rounded ${DAY_BADGE[cls.dayOfWeek] || "bg-gray-400"}`}>
                                                            {DAYS.find((d) => d.value === cls.dayOfWeek)?.label || cls.dayOfWeek}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                                                        {cls.startTime} ~ {cls.endTime}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-gray-500">{cls.location || "-"}</td>
                                                    <td className="px-5 py-3.5 text-center text-gray-600">{cls.capacity}명</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* CTA */}
            <section className="bg-brand-navy-900 text-white py-14">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-2xl font-black mb-4">수강 문의</h2>
                    <p className="text-blue-200 mb-6">원하시는 시간대가 없다면 문의해 주세요. 최대한 맞춰드리겠습니다.</p>
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
