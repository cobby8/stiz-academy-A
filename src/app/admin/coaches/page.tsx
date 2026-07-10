import { Suspense } from "react";
import { getCoaches } from "@/lib/queries";
import CoachesAdminClient from "./CoachesAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function CoachesLoadingFallback() {
    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="h-8 w-44 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-10 w-28 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
                    <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-36 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between gap-4 px-6 py-4">
                            <div className="flex min-w-0 flex-1 items-center gap-4">
                                <div className="h-14 w-14 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="h-5 w-36 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-4 w-56 max-w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                </div>
                            </div>
                            <div className="hidden gap-2 sm:flex">
                                <div className="h-8 w-16 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="h-8 w-16 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

async function CoachesDataSection() {
    const coaches = await getCoaches();
    return <CoachesAdminClient initialCoaches={coaches as any[]} />;
}

export default function AdminCoachesPage() {
    return (
        <Suspense fallback={<CoachesLoadingFallback />}>
            <CoachesDataSection />
        </Suspense>
    );
}
