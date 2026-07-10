import { getClassWithStudents, getSessionsByClass, getCoaches } from "@/lib/queries";
import ClassDetailClient from "./ClassDetailClient";
import { notFound } from "next/navigation";
import { Suspense } from "react";

// 30초 캐시: Server Action 호출 시 즉시 무효화됨
export const revalidate = 30;

function ClassDetailLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div>
                        <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                        <div className="mt-2 h-4 w-72 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    </div>
                </div>
                <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                        <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        <div className="mt-4 h-8 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </div>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="border-b border-gray-100 p-5 dark:border-gray-700">
                        <div className="h-6 w-36 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="flex items-center gap-4 p-4">
                                <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                <div className="min-w-0 flex-1">
                                    <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                    <div className="mt-2 h-3 w-48 max-w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                </div>
                                <div className="h-8 w-20 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, index) => (
                        <div
                            key={index}
                            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                        >
                            <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                            <div className="mt-5 space-y-3">
                                {Array.from({ length: 4 }).map((__, rowIndex) => (
                                    <div key={rowIndex} className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

async function ClassDetailDataSection({ id }: { id: string }) {
    // 반 정보 + 수강생 + 수업 기록 + 코치 목록을 병렬로 조회
    const [classData, sessions, coaches] = await Promise.all([
        getClassWithStudents(id),
        getSessionsByClass(id),
        getCoaches(),
    ]);

    // 반이 없으면 404 페이지 표시
    if (!classData) notFound();

    return <ClassDetailClient classData={classData} sessions={sessions} coaches={coaches} />;
}

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 16에서 params는 Promise — await 필요
    const { id } = await params;

    return (
        <Suspense fallback={<ClassDetailLoadingFallback />}>
            <ClassDetailDataSection id={id} />
        </Suspense>
    );
}
