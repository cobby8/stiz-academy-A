/**
 * 체험수업 신청 페이지 — 서버 컴포넌트
 * 시간표에서 빈자리 슬롯을 조회한 뒤 클라이언트 폼에 전달
 */
import { getAcademySettings } from "@/lib/queries";
import { getAvailableTrialSlots } from "@/app/actions/public";
import PublicPageLayout from "@/components/PublicPageLayout";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import TrialApplicationForm from "./TrialApplicationForm";

export const revalidate = 60;
export const metadata = {
    title: "체험수업 신청 | STIZ 농구교실 다산점",
    description: "스티즈 농구교실 다산점 체험수업을 신청하세요. 빈자리가 있는 수업을 선택할 수 있습니다.",
};

export default async function TrialApplyPage() {
    // 빈자리 슬롯 + 학원 설정(연락처 등)을 병렬 조회
    const [slots, settings] = await Promise.all([
        getAvailableTrialSlots(),
        getAcademySettings() as Promise<any>,
    ]);

    const phone = settings?.contactPhone || "010-0000-0000";

    return (
        <PublicPageLayout>
            {/* 히어로 섹션 — 공개 페이지 표준 패턴 */}
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900 text-white py-12 md:py-16">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute right-0 top-0 w-72 h-72 border-[20px] border-white/5 rounded-full translate-x-1/3 -translate-y-1/3" />
                    <div className="absolute left-0 bottom-0 w-48 h-48 border-[15px] border-brand-orange-500/10 rounded-full -translate-x-1/4 translate-y-1/4" />
                </div>
                <div className="max-w-3xl mx-auto px-6 relative">
                    <AnimateOnScroll>
                        <p className="text-brand-orange-500 text-sm font-bold uppercase tracking-widest mb-3">TRIAL CLASS</p>
                        <h1 className="text-3xl md:text-4xl font-black mb-3 break-keep">체험수업 신청</h1>
                        <p className="text-blue-200 text-base max-w-xl">간단한 정보를 입력하고 원하는 수업 시간을 선택하세요.</p>
                    </AnimateOnScroll>
                </div>
            </section>

            {/* 신청 폼 — 클라이언트 컴포넌트 */}
            <section className="py-8 md:py-12 bg-gray-50">
                <div className="max-w-2xl mx-auto px-4">
                    <TrialApplicationForm
                        availableSlots={slots}
                        contactPhone={phone}
                    />
                </div>
            </section>
        </PublicPageLayout>
    );
}
