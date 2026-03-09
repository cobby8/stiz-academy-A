import { getAcademySettings, getClassSlotOverrides } from "@/lib/queries";
import { fetchSheetSchedule } from "@/lib/googleSheetsSchedule";
import type { SheetClassSlot } from "@/lib/googleSheetsSchedule";
import PublicPageLayout from "@/components/PublicPageLayout";

export const revalidate = 300;
export const metadata = { title: "수업시간표 | STIZ 농구교실 다산점" };

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_BG: Record<string, string> = {
    Mon: "bg-blue-600",  Tue: "bg-green-600",  Wed: "bg-yellow-500",
    Thu: "bg-purple-600", Fri: "bg-red-500",   Sat: "bg-brand-orange-500",
    Sun: "bg-gray-500",
};
const DAY_CARD_BG: Record<string, string> = {
    Mon: "bg-blue-50 border-blue-200",  Tue: "bg-green-50 border-green-200",
    Wed: "bg-yellow-50 border-yellow-200", Thu: "bg-purple-50 border-purple-200",
    Fri: "bg-red-50 border-red-200",    Sat: "bg-orange-50 border-orange-200",
    Sun: "bg-gray-50 border-gray-200",
};

export default async function SchedulePage() {
    const settings = await getAcademySettings() as any;
    const phone = settings.contactPhone || "010-0000-0000";
    const sheetUrl = settings?.googleSheetsScheduleUrl as string | null | undefined;

    const [rawSlots, overridesList] = await Promise.all([
        sheetUrl ? fetchSheetSchedule(sheetUrl) : Promise.resolve([]),
        getClassSlotOverrides(),
    ]);

    // overrides map: slotKey → override record
    const overrideMap = Object.fromEntries(overridesList.map((o: any) => [o.slotKey, o]));

    // Merge: apply overrides, filter hidden
    const slots: (SheetClassSlot & {
        displayLabel: string;
        note: string | null;
        capacity: number;
        isFull: boolean;
    })[] = rawSlots
        .filter((s: SheetClassSlot) => !(overrideMap[s.slotKey]?.isHidden))
        .map((s: SheetClassSlot) => {
            const ov = overrideMap[s.slotKey];
            const capacity: number = ov?.capacity ?? 12;
            return {
                ...s,
                displayLabel: ov?.label || `${s.dayLabel} ${s.period}교시`,
                note: ov?.note || null,
                capacity,
                isFull: s.enrolled >= capacity,
            };
        });

    // Group by day
    const byDay = DAY_ORDER.reduce<Record<string, typeof slots>>((acc, d) => {
        acc[d] = slots.filter((s) => s.dayKey === d).sort((a, b) => a.period - b.period);
        return acc;
    }, {});
    const activeDays = DAY_ORDER.filter((d) => byDay[d].length > 0);

    const hasData = slots.length > 0;

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
                    {!hasData ? (
                        <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-200">
                            <div className="text-5xl mb-4">📅</div>
                            <p className="text-lg font-medium">시간표를 준비 중입니다.</p>
                            <p className="text-sm mt-2">문의: {phone}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {activeDays.map((dayKey) => (
                                <div
                                    key={dayKey}
                                    className={`rounded-2xl border ${DAY_CARD_BG[dayKey]} overflow-hidden`}
                                >
                                    {/* Day header */}
                                    <div className={`${DAY_BG[dayKey]} text-white px-5 py-3 flex items-center gap-3`}>
                                        <span className="font-black text-lg">{byDay[dayKey][0].dayLabel}</span>
                                        <span className="text-white/70 text-sm font-medium">
                                            {byDay[dayKey].length}개 클래스
                                        </span>
                                    </div>
                                    <div className="p-4">
                                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {byDay[dayKey].map((slot) => (
                                                <div
                                                    key={slot.slotKey}
                                                    className="bg-white rounded-xl p-4 shadow-sm border border-white/80 relative"
                                                >
                                                    {/* 마감 badge */}
                                                    {slot.isFull && (
                                                        <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                                            마감
                                                        </span>
                                                    )}

                                                    {/* Label */}
                                                    <h4 className="font-bold text-gray-900 mb-2 pr-10 text-sm">
                                                        {slot.displayLabel}
                                                    </h4>

                                                    {/* Time */}
                                                    <div className="flex items-center gap-1.5 text-sm text-gray-700 mb-1">
                                                        <span className="text-gray-400">⏰</span>
                                                        <span className="font-semibold">
                                                            {slot.startTime} ~ {slot.endTime}
                                                        </span>
                                                    </div>

                                                    {/* Grade range */}
                                                    {slot.gradeRange && (
                                                        <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                                                            <span className="text-gray-400">🎓</span>
                                                            <span>{slot.gradeRange}</span>
                                                        </div>
                                                    )}

                                                    {/* Enrollment */}
                                                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                                                        <span className="text-xs text-gray-400">
                                                            {slot.enrolled}/{slot.capacity}명
                                                        </span>
                                                        {/* Enrollment bar */}
                                                        <div className="flex-1 mx-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${
                                                                    slot.isFull ? "bg-red-400" : "bg-brand-orange-500"
                                                                }`}
                                                                style={{ width: `${Math.min(100, (slot.enrolled / slot.capacity) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Note */}
                                                    {slot.note && (
                                                        <p className="text-xs text-brand-orange-600 mt-2 font-medium">
                                                            📌 {slot.note}
                                                        </p>
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
