import { Suspense } from "react";
import { getBillingTemplates, getPrograms } from "@/lib/queries";
import BillingTemplateClient from "./BillingTemplateClient";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function BillingTemplateLoadingFallback() {
    return (
        <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                    <div className="h-8 w-52 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-10 w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                        <div className="grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.7fr_0.8fr] gap-4 bg-gray-50 px-5 py-3 dark:bg-gray-900">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div key={index} className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            ))}
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {Array.from({ length: 6 }).map((_, rowIndex) => (
                                <div
                                    key={rowIndex}
                                    className="grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.7fr_0.8fr] gap-4 px-5 py-4"
                                >
                                    <div className="space-y-2">
                                        <div className="h-5 w-36 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                        <div className="h-3 w-48 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    </div>
                                    <div className="h-5 w-20 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-5 w-24 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-5 w-20 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-6 w-12 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    <div className="ml-auto h-5 w-20 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

async function BillingTemplateDataSection() {
    // 청구 템플릿 목록과 프로그램 목록을 동시에 조회
    const [templates, programs] = await Promise.all([
        getBillingTemplates(),
        getPrograms(),
    ]);
    return (
        <BillingTemplateClient
            initialTemplates={templates}
            programs={programs}
        />
    );
}

export default function BillingTemplatePage() {
    return (
        <Suspense fallback={<BillingTemplateLoadingFallback />}>
            <BillingTemplateDataSection />
        </Suspense>
    );
}
