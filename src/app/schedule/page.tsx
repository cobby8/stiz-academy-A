import { getAcademySettings, getClassSlotOverrides, getCustomClassSlots, getPrograms } from "@/lib/queries";
import { fetchSheetSchedule } from "@/lib/googleSheetsSchedule";
import type { SheetClassSlot } from "@/lib/googleSheetsSchedule";
import PublicPageLayout from "@/components/PublicPageLayout";

// searchParams 사용으로 페이지는 이미 동적 렌더링됨.
// force-dynamic 을 제거해야 fetchSheetSchedule 의 next.revalidate=300 캐시가 실제로 동작함.
// (force-dynamic 상태에서는 모든 fetch 가 no-store 로 강제되어 매 요청마다 구글시트를 호출함)
export const revalidate = 300;
export const metadata = { title: "수업시간표 | STIZ 농구교실 다산점" };

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_KEY_TO_LABEL: Record<string, string> = {
    Mon: "월요일", Tue: "화요일", Wed: "수요일", Thu: "목요일",
    Fri: "금요일", Sat: "토요일", Sun: "일요일",
};

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

type MergedSlot = {
    slotKey: string;
    dayKey: string;
    dayLabel: string;
    startTime: string;
    endTime: string;
    gradeRange: string;
    enrolled: number;
    displayLabel: string;
    note: string | null;
    capacity: number;
    isFull: boolean;
    coach: { name: string; role: string; imageUrl: string | null } | null;
    programId: string | null;
};

export default async function SchedulePage({
    searchParams,
}: {
    searchParams: Promise<{ program?: string }>;
}) {
    const { program: filterProgramId } = await searchParams;

    const settings = await getAcademySettings() as any;
    const phone = settings.contactPhone || "010-0000-0000";
    const sheetUrl = settings?.googleSheetsScheduleUrl as string | null | undefined;

    const [rawSlots, overridesList, customSlotsList, programs] = await Promise.all([
        sheetUrl ? fetchSheetSchedule(sheetUrl) : Promise.resolve([]),
        getClassSlotOverrides(),
        getCustomClassSlots(),
        getPrograms(),
    ]);

    // overrides map: slotKey → override record
    const overrideMap = Object.fromEntries(overridesList.map((o: any) => [o.slotKey, o]));

    // Merge sheet slots: apply overrides, filter hidden
    const sheetMerged: MergedSlot[] = rawSlots
        .filter((s: SheetClassSlot) => !(overrideMap[s.slotKey]?.isHidden))
        .map((s: SheetClassSlot) => {
            const ov = overrideMap[s.slotKey];
            const capacity: number = ov?.capacity ?? 12;
            return {
                slotKey: s.slotKey,
                dayKey: s.dayKey,
                dayLabel: s.dayLabel,
                startTime: ov?.startTimeOverride || s.startTime,
                endTime: ov?.endTimeOverride || s.endTime,
                gradeRange: s.gradeRange,
                enrolled: s.enrolled,
                displayLabel: ov?.label || `${s.dayLabel} ${s.period}교시`,
                note: ov?.note || null,
                capacity,
                isFull: s.enrolled >= capacity,
                coach: ov?.coach ?? null,
                programId: ov?.programId ?? null,
            };
        });

    // Custom slots: filter hidden, convert to MergedSlot shape
    const customMerged: MergedSlot[] = (customSlotsList as any[])
        .filter((cs) => !cs.isHidden)
        .map((cs) => ({
            slotKey: `custom-${cs.id}`,
            dayKey: cs.dayKey,
            dayLabel: DAY_KEY_TO_LABEL[cs.dayKey] || cs.dayKey,
            startTime: cs.startTime,
            endTime: cs.endTime,
            gradeRange: cs.gradeRange || "",
            enrolled: cs.enrolled,
            displayLabel: cs.label,
            note: cs.note || null,
            capacity: cs.capacity,
            isFull: cs.enrolled >= cs.capacity,
            coach: cs.coach ?? null,
            programId: cs.programId ?? null,
        }));

    // Merge all, then apply program filter
    let allSlots = [...sheetMerged, ...customMerged];
    if (filterProgramId) {
        allSlots = allSlots.filter((s) => s.programId === filterProgramId);
    }

    const byDay = DAY_ORDER.reduce<Record<string, MergedSlot[]>>((acc, d) => {
        acc[d] = allSlots
            .filter((s) => s.dayKey === d)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
        return acc;
    }, {});
    const activeDays = DAY_ORDER.filter((d) => byDay[d].length > 0);

    const hasData = allSlots.length > 0;
    const selectedProgram = (programs as any[]).find((p) => p.id === filterProgramId);

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

            {/* Program Filter Tabs */}
            {(programs as any[]).length > 0 && (
                <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                    <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap gap-2 items-center">
                        <a
                            href="/schedule"
                            className={`text-sm font-bold px-4 py-1.5 rounded-full transition ${!filterProgramId ? "bg-brand-navy-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                            전체
                        </a>
                        {(programs as any[]).map((p) => (
                            <a
                                key={p.id}
                                href={`/schedule?program=${p.id}`}
                                className={`text-sm font-bold px-4 py-1.5 rounded-full transition ${filterProgramId === p.id ? "bg-brand-navy-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                            >
                                {p.name}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Schedule Grid */}
            <section className="py-14 bg-gray-50">
                <div className="max-w-5xl mx-auto px-4">
                    {filterProgramId && selectedProgram && (
                        <div className="mb-6 bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs text-gray-400 mb-0.5">프로그램 필터</p>
                                <p className="font-bold text-gray-900">{selectedProgram.name}</p>
                            </div>
                            <a href="/schedule" className="text-sm text-gray-500 hover:text-gray-700 font-medium underline">
                                전체 보기
                            </a>
                        </div>
                    )}
                    {!hasData ? (
                        <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-200">
                            <div className="text-5xl mb-4">📅</div>
                            <p className="text-lg font-medium">
                                {filterProgramId ? "해당 프로그램의 수업이 없습니다." : "시간표를 준비 중입니다."}
                            </p>
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
                                                    className="bg-white rounded-xl p-4 shadow-sm border border-white/80"
                                                >
                                                    <div className="flex gap-3">
                                                        {/* Left: slot info */}
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-gray-900 mb-2 text-sm">
                                                                {slot.displayLabel}
                                                            </h4>
                                                            <div className="flex items-center gap-1.5 text-sm text-gray-700 mb-1">
                                                                <span className="text-gray-400">⏰</span>
                                                                <span className="font-semibold">{slot.startTime} ~ {slot.endTime}</span>
                                                            </div>
                                                            {slot.gradeRange && (
                                                                <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                                                                    <span className="text-gray-400">🎓</span>
                                                                    <span>{slot.gradeRange}</span>
                                                                </div>
                                                            )}
                                                            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                                                                {slot.isFull ? (
                                                                    <span className="shrink-0 text-[10px] bg-red-500 text-white font-black px-2 py-0.5 rounded-full">마감</span>
                                                                ) : slot.enrolled > 10 ? (
                                                                    <span className="shrink-0 text-[10px] bg-brand-orange-500 text-white font-black px-2 py-0.5 rounded-full">마감임박</span>
                                                                ) : null}
                                                                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all ${slot.isFull ? "bg-red-400" : slot.enrolled > 10 ? "bg-brand-orange-500" : "bg-green-400"}`}
                                                                        style={{ width: `${Math.min(100, (slot.enrolled / slot.capacity) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            {slot.note && (
                                                                <p className="text-xs text-brand-orange-600 mt-2 font-medium">📌 {slot.note}</p>
                                                            )}
                                                        </div>

                                                        {/* Right: Coach */}
                                                        {slot.coach && (
                                                            <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5 w-[58px]">
                                                                {slot.coach.imageUrl ? (
                                                                    <img
                                                                        src={slot.coach.imageUrl}
                                                                        alt={slot.coach.name}
                                                                        className="w-11 h-11 rounded-full object-cover border-2 border-gray-100"
                                                                    />
                                                                ) : (
                                                                    <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-lg">🏀</div>
                                                                )}
                                                                <p className="text-[11px] font-bold text-gray-800 text-center leading-tight truncate w-full">
                                                                    {slot.coach.name}
                                                                </p>
                                                                <p className="text-[10px] text-gray-400 text-center leading-tight truncate w-full">
                                                                    {slot.coach.role}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
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
