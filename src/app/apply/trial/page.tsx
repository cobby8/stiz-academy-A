import { redirect } from "next/navigation";
import { getAcademySettings } from "@/lib/queries";
import { getAvailableTrialSlots } from "@/app/actions/public";
import PublicPageLayout from "@/components/PublicPageLayout";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import TrialApplicationForm from "./TrialApplicationForm";
import { buildPublicMetadata } from "@/lib/publicMetadata";

export const revalidate = 60;

export const metadata = buildPublicMetadata({
    title: "체험수업 신청 | STIZ 농구교실 다산점",
    description: "스티즈 농구교실 다산점 체험수업을 신청하세요. 빈자리가 있는 수업을 선택할 수 있습니다.",
    path: "/apply/trial",
    imageAlt: "STIZ 농구교실 다산점 체험수업 신청 미리보기",
});

export default async function TrialApplyPage() {
    const [slots, settings] = await Promise.all([
        getAvailableTrialSlots(),
        getAcademySettings() as Promise<any>,
    ]);

    if (!settings?.useBuiltInTrialForm) {
        redirect(settings?.trialFormUrl || "/apply");
    }

    const phone = settings?.contactPhone || "010-0000-0000";

    return (
        <PublicPageLayout>
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900 py-12 text-white md:py-16">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute right-0 top-0 h-72 w-72 translate-x-1/3 -translate-y-1/3 rounded-full border-[20px] border-white/5 transition-colors duration-300 dark:border-brand-neon-cobalt/10" />
                    <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-1/4 translate-y-1/4 rounded-full border-[15px] border-brand-orange-500/10 transition-colors duration-300 dark:border-brand-neon-lime/10" />
                </div>
                <div className="relative mx-auto max-w-3xl px-6">
                    <AnimateOnScroll>
                        <p className="mb-3 text-sm font-bold uppercase tracking-widest text-brand-orange-500 dark:text-brand-neon-lime">TRIAL CLASS</p>
                        <h1 className="mb-3 break-keep text-3xl font-black md:text-4xl">체험수업 신청</h1>
                        <p className="max-w-xl text-base text-blue-200">간단한 정보를 입력하고 원하는 수업 시간을 선택하세요.</p>
                    </AnimateOnScroll>
                </div>
            </section>

            <section className="bg-gray-50 py-8 dark:bg-gray-900 md:py-12">
                <div className="mx-auto max-w-2xl px-4">
                    <TrialApplicationForm availableSlots={slots} contactPhone={phone} />
                </div>
            </section>
        </PublicPageLayout>
    );
}
