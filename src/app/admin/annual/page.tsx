import { Suspense } from "react";
import { getAnnualEvents, getAcademySettings } from "@/lib/queries";
import AnnualAdminClient from "./AnnualAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function AnnualLoadingFallback() {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6 gap-4">
                <div>
                    <div className="h-8 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="mt-3 h-4 w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                <div className="mt-2 h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                <div className="mt-4 flex gap-2">
                    <div className="h-10 flex-1 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                    <div className="h-10 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
            </div>
            <div className="space-y-6">
                {Array.from({ length: 2 }).map((_, yearIndex) => (
                    <section key={yearIndex}>
                        <div className="mb-3 h-6 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                            {Array.from({ length: 4 }).map((_, rowIndex) => (
                                <div key={rowIndex} className="flex items-center justify-between gap-4 border-b border-gray-100 p-4 last:border-b-0 dark:border-gray-700">
                                    <div className="flex min-w-0 flex-1 items-center gap-4">
                                        <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                            <div className="h-4 w-1/2 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="hidden gap-2 sm:flex">
                                        <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                        <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

async function AnnualDataSection() {
    // 이벤트 목록과 설정(ICS URL)을 병렬로 가져옴
    const [events, settings] = await Promise.all([
        getAnnualEvents(),
        getAcademySettings(),
    ]);
    return (
        <AnnualAdminClient
            events={events}
            initialIcsUrl={settings?.googleCalendarIcsUrl || ""}
        />
    );
}

export default function AnnualAdminPage() {
    return (
        <Suspense fallback={<AnnualLoadingFallback />}>
            <AnnualDataSection />
        </Suspense>
    );
}
