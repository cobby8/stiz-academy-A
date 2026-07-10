import { getStudentActivity } from "@/lib/queries";
import StudentDetailClient from "./StudentDetailClient";
import { notFound } from "next/navigation";
import { Suspense } from "react";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function StudentDetailLoadingFallback() {
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div>
                    <div className="h-8 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800"
                    >
                        <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        <div className="mt-3 h-8 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                        <div className="mt-2 h-3 w-16 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div
                            key={index}
                            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-800"
                        >
                            <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                            <div className="mt-4 space-y-3">
                                {Array.from({ length: 3 }).map((__, rowIndex) => (
                                    <div key={rowIndex} className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="space-y-4 lg:col-span-2">
                    {Array.from({ length: 2 }).map((_, sectionIndex) => (
                        <div
                            key={sectionIndex}
                            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-800"
                        >
                            <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                            <div className="mt-4 space-y-3">
                                {Array.from({ length: 6 }).map((__, rowIndex) => (
                                    <div key={rowIndex} className="grid grid-cols-3 gap-3">
                                        <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                        <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                        <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

async function StudentDetailDataSection({ id }: { id: string }) {
    const data = await getStudentActivity(id);
    if (!data) notFound();
    return <StudentDetailClient data={data} />;
}

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return (
        <Suspense fallback={<StudentDetailLoadingFallback />}>
            <StudentDetailDataSection id={id} />
        </Suspense>
    );
}
