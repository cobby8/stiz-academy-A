import { getAcademySettings, getClassSlotOverrides, getCustomClassSlots, getPrograms, getSheetSlotCache } from "@/lib/queries";
import { fetchSheetSchedule, type SheetClassSlot } from "@/lib/googleSheetsSchedule";
import PublicPageLayout from "@/components/PublicPageLayout";
import ScheduleClient, { type MergedSlot } from "./ScheduleClient";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import CTABanner from "@/components/landing/CTABanner";

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
            {/* 페이지 히어로 — about/programs와 동일한 그라데이션 + 장식 도형 패턴 */}
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900 text-white py-16 md:py-20">
                {/* 배경 장식 도형들 — 시각적 깊이감 */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute right-0 top-0 w-72 h-72 border-[20px] border-white/5 rounded-full translate-x-1/3 -translate-y-1/3" />
                    <div className="absolute left-0 bottom-0 w-48 h-48 border-[15px] border-brand-orange-500/10 rounded-full -translate-x-1/4 translate-y-1/4" />
                </div>
                <div className="max-w-6xl mx-auto px-4 relative">
                    <AnimateOnScroll>
                        <p className="text-brand-orange-500 text-sm font-bold uppercase tracking-widest mb-3">SCHEDULE</p>
                        <h1 className="text-4xl md:text-5xl font-black mb-4">수업시간표</h1>
                        <p className="text-blue-200 text-lg max-w-xl">요일별 수업 시간과 담당 코치를 확인하세요.</p>
                    </AnimateOnScroll>
                </div>
            </section>

            {/* 필터 탭 + 시간표 그리드 (클라이언트 컴포넌트 — useSearchParams 사용) */}
            <ScheduleClient
                programs={(programs as any[]).map((p) => ({ id: p.id, name: p.name }))}
                allSlots={allSlots}
                phone={phone}
            />

            {/* CTA 배너 — 공통 CTABanner 재사용 */}
            <CTABanner
                title="원하시는 시간대가 없으신가요?"
                subtitle="문의해 주시면 최대한 맞춰드리겠습니다"
                phone={phone}
                primaryLabel="체험 수업 신청"
                primaryHref="/apply"
            />
        </PublicPageLayout>
    );
}
