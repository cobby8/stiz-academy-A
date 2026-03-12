import { getAcademySettings } from "@/lib/queries";
import PublicPageLayout from "@/components/PublicPageLayout";
import ApplyPageClient from "./ApplyPageClient";

export const revalidate = 60;
export const metadata = { title: "체험/수강신청 | STIZ 농구교실 다산점", description: "스티즈 농구교실 다산점 체험 수업 신청 및 수강 신청 안내. 지금 바로 신청하세요." };

export default async function ApplyPage() {
    const settings = (await getAcademySettings()) as any;

    return (
        <PublicPageLayout>
            {/* Hero */}
            <div className="bg-brand-navy-900 text-white py-14">
                <div className="max-w-4xl mx-auto px-4">
                    <p className="text-brand-orange-500 text-sm font-bold uppercase mb-2 tracking-widest">Apply</p>
                    <h1 className="text-4xl font-black mb-3">체험 / 수강신청</h1>
                    <p className="text-blue-200">스티즈 농구교실을 직접 경험해 보세요.</p>
                </div>
            </div>

            <ApplyPageClient
                trialTitle={settings?.trialTitle || "체험수업 안내"}
                trialContent={settings?.trialContent || null}
                trialFormUrl={settings?.trialFormUrl || null}
                enrollTitle={settings?.enrollTitle || "수강신청 안내"}
                enrollContent={settings?.enrollContent || null}
                enrollFormUrl={settings?.enrollFormUrl || null}
            />
        </PublicPageLayout>
    );
}
