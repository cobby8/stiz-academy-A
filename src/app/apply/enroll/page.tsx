/**
 * 수강 신청 페이지 — 서버 컴포넌트
 *
 * searchParams.trialId가 있으면 체험 데이터를 자동 채움하고,
 * 빈자리 슬롯 목록을 조회하여 클라이언트 폼에 전달한다.
 */
import { redirect } from "next/navigation";
import { getAcademySettings } from "@/lib/queries";
import { getAvailableTrialSlots, getTrialLeadForEnroll } from "@/app/actions/public";
import PublicPageLayout from "@/components/PublicPageLayout";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import EnrollApplicationForm from "./EnrollApplicationForm";

export const revalidate = 60;
export const metadata = {
    title: "수강 신청 | STIZ 농구교실 다산점",
    description: "스티즈 농구교실 다산점 수강 신청. 간단한 정보 입력으로 우리 아이의 농구 여정을 시작하세요.",
};

export default async function EnrollApplyPage({
    searchParams,
}: {
    searchParams: Promise<{ trialId?: string }>;
}) {
    const params = await searchParams;
    const trialId = params.trialId || null;

    // 체험 데이터 + 빈자리 슬롯 + 학원 설정을 병렬 조회 (성능 최적화)
    const [trialData, slots, settings] = await Promise.all([
        trialId ? getTrialLeadForEnroll(trialId) : Promise.resolve(null),
        getAvailableTrialSlots(),
        getAcademySettings() as Promise<any>,
    ]);

    // 구글폼 모드일 때: 자체 폼 대신 구글폼 URL 또는 /apply로 리다이렉트
    if (!settings?.useBuiltInEnrollForm) {
        redirect(settings?.enrollFormUrl || "/apply");
    }

    const phone = settings?.contactPhone || "010-0000-0000";

    return (
        <PublicPageLayout>
            {/* 히어로 섹션 — 공개 페이지 표준 패턴 (체험 폼과 동일 구조) */}
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900 text-white py-12 md:py-16">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute right-0 top-0 w-72 h-72 border-[20px] border-white/5 dark:border-brand-neon-cobalt/10 rounded-full translate-x-1/3 -translate-y-1/3 transition-colors duration-300" />
                    <div className="absolute left-0 bottom-0 w-48 h-48 border-[15px] border-brand-orange-500/10 dark:border-brand-neon-lime/10 rounded-full -translate-x-1/4 translate-y-1/4 transition-colors duration-300" />
                </div>
                <div className="max-w-3xl mx-auto px-6 relative">
                    <AnimateOnScroll>
                        <p className="text-brand-orange-500 dark:text-brand-neon-lime text-sm font-bold uppercase tracking-widest mb-3">ENROLLMENT</p>
                        <h1 className="text-3xl md:text-4xl font-black mb-3 break-keep">수강 신청</h1>
                        <p className="text-blue-200 text-base max-w-xl">
                            {trialData
                                ? "체험수업 정보가 자동으로 채워졌습니다. 확인 후 추가 정보를 입력해주세요."
                                : "간단한 정보를 입력하고 원하는 수업 시간을 선택하세요."}
                        </p>
                    </AnimateOnScroll>
                </div>
            </section>

            {/* 수강 신청 폼 — 클라이언트 컴포넌트 */}
            <section className="py-8 md:py-12 bg-gray-50 dark:bg-gray-900">
                <div className="max-w-2xl mx-auto px-4">
                    <EnrollApplicationForm
                        availableSlots={slots}
                        contactPhone={phone}
                        trialData={trialData}
                        trialLeadId={trialId}
                    />
                </div>
            </section>
        </PublicPageLayout>
    );
}
