import { Suspense } from "react";
import { getPrograms } from "@/lib/queries";
import ProgramsAdminClient from "./ProgramsAdminClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function ProgramsLoadingFallback() {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <div className="h-8 w-44 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-10 w-28 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
                    <div className="h-10 w-32 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="h-5 w-64 rounded bg-blue-100 animate-pulse" />
                <div className="mt-3 flex flex-wrap gap-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-8 w-36 rounded-lg bg-white animate-pulse" />
                    ))}
                </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
                    <div className="h-6 w-44 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-44 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex">
                            <div className="w-10 border-r border-gray-100 dark:border-gray-800">
                                <div className="mx-auto mt-6 h-5 w-5 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            </div>
                            <div className="flex-1 p-5">
                                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                                    <div className="min-w-0 flex-1 space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                            <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                            <div className="h-5 w-16 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                            <div className="h-5 w-16 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                        </div>
                                        <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                        <div className="h-4 w-1/2 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="h-8 w-14 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                        <div className="h-8 w-14 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

async function ProgramsDataSection() {
    let programs: any[] = [];
    try {
        programs = await getPrograms();
    } catch (e) {
        console.error("Error fetching programs:", e);
    }
    return <ProgramsAdminClient programs={programs} />;
}

export default function AdminProgramsPage() {
    return (
        <Suspense fallback={<ProgramsLoadingFallback />}>
            <ProgramsDataSection />
        </Suspense>
    );
}
