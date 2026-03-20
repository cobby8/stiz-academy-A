import { getAcademySettings } from "@/lib/queries";
import PublicPageLayout from "@/components/PublicPageLayout";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import SectionLayout from "@/components/ui/SectionLayout";
import ProcessSteps from "@/components/landing/ProcessSteps";
import CTABanner from "@/components/landing/CTABanner";
import ApplyPageClient from "./ApplyPageClient";

export const revalidate = 60;
export const metadata = { title: "체험/수강신청 | STIZ 농구교실 다산점", description: "스티즈 농구교실 다산점 체험 수업 신청 및 수강 신청 안내. 지금 바로 신청하세요." };

export default async function ApplyPage() {
    const settings = (await getAcademySettings()) as any;
    const phone = settings?.contactPhone || "010-0000-0000";

    return (
        <PublicPageLayout>
            {/* 페이지 히어로 — 그라데이션 배경 + 장식 도형 (about/page.tsx 패턴 동일) */}
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900 text-white py-16 md:py-20">
                {/* 배경 장식 도형들 */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute right-0 top-0 w-72 h-72 border-[20px] border-white/5 rounded-full translate-x-1/3 -translate-y-1/3" />
                    <div className="absolute left-0 bottom-0 w-48 h-48 border-[15px] border-brand-orange-500/10 rounded-full -translate-x-1/4 translate-y-1/4" />
                </div>
                <div className="max-w-6xl mx-auto px-4 relative">
                    <AnimateOnScroll>
                        <p className="text-brand-orange-500 text-sm font-bold uppercase tracking-widest mb-3">APPLY</p>
                        <h1 className="text-4xl md:text-5xl font-black mb-4">체험 / 수강신청</h1>
                        {/* 진입 장벽 낮추는 핵심 메시지 */}
                        <p className="text-blue-200 text-lg max-w-xl">1분이면 충분해요! 간단한 신청으로 우리 아이의 농구 여정을 시작하세요.</p>
                    </AnimateOnScroll>
                </div>
            </section>

            {/* 수강 과정 4단계 안내 — ProcessSteps 재사용 */}
            <ProcessSteps />

            {/* 체험수업/수강신청 카드 + FAQ — 클라이언트 컴포넌트 */}
            <ApplyPageClient
                trialTitle={settings?.trialTitle || "체험수업 안내"}
                trialContent={settings?.trialContent || null}
                trialFormUrl={settings?.trialFormUrl || null}
                enrollTitle={settings?.enrollTitle || "수강신청 안내"}
                enrollContent={settings?.enrollContent || null}
                enrollFormUrl={settings?.enrollFormUrl || null}
            />

            {/* CTA 배너 — 하단 행동 유도 (about 페이지와 동일 패턴) */}
            <CTABanner
                title="궁금한 점이 있으신가요?"
                subtitle="전화 한 통이면 친절하게 안내해 드립니다"
                phone={phone}
                primaryLabel="체험 수업 신청"
                primaryHref="/apply"
            />
        </PublicPageLayout>
    );
}
