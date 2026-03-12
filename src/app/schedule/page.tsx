import { getAcademySettings, getClassSlotOverrides, getCustomClassSlots, getPrograms, getSheetSlotCache } from "@/lib/queries";
import { fetchSheetSchedule, type SheetClassSlot } from "@/lib/googleSheetsSchedule";
import PublicPageLayout from "@/components/PublicPageLayout";
import ScheduleClient, { type MergedSlot } from "./ScheduleClient";

// searchParams 없음 → ISR 정적 캐싱 (5분) 활성화
// 프로그램 필터는 ScheduleClient(클라이언트)에서 useSearchParams()로 처리
export const revalidate = 300;
export const metadata = { title: "수업시간표 | STIZ 농구교실 다산점", description: "스티즈 농구교실 다산점 요일별 수업 시간표. 프로그램별 클래스 시간 및 담당 코치 확인." };

const DAY_KEY_TO_LABEL: Record<string, string> = {
    Mon: "월요일", Tue: "화요일", Wed: "수요일", Thu: "목요일",
    Fri: "금요일", Sat: "토요일", Sun: "일요일",
};

export default async function SchedulePage() {
    const [settings, cachedSlots, overridesList, customSlotsList, programs] = await Promise.all([
        getAcademySettings(),
        getSheetSlotCache(),
        getClassSlotOverrides(),
        getCustomClassSlots(),
        getPrograms(),
    ]);

    const phone = (settings as any).contactPhone || "010-0000-0000";
    const sheetUrl = (settings as any).googleSheetsScheduleUrl as string | null | undefined;

    // DB 캐시가 비어있으면 Google Sheets에서 직접 읽기 (폴백)
    let rawSlots: SheetClassSlot[] = cachedSlots ?? [];
    if (rawSlots.length === 0 && sheetUrl) {
        try {
            rawSlots = await fetchSheetSchedule(sheetUrl);
        } catch {
            rawSlots = [];
        }
    }

    const overrideMap = Object.fromEntries(overridesList.map((o: any) => [o.slotKey, o]));

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

    const allSlots: MergedSlot[] = [...sheetMerged, ...customMerged];

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

            {/* 필터 탭 + 시간표 그리드 (클라이언트 컴포넌트 — useSearchParams 사용) */}
            <ScheduleClient
                programs={(programs as any[]).map((p) => ({ id: p.id, name: p.name }))}
                allSlots={allSlots}
                phone={phone}
            />

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
