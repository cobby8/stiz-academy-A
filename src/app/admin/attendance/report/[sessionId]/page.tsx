import { getSessionReport, getCoaches } from "@/lib/queries";
import { notFound } from "next/navigation";
import ReportEditClient from "./ReportEditClient";
import { Suspense } from "react";

// 관리자 리포트 편집은 30초 캐시
export const revalidate = 30;

function ReportEditLoadingFallback() {
    return (
        <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                    <div className="h-5 w-28 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    <div className="mt-3 h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-8 w-24 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>

            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="h-7 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="mt-5 space-y-4">
                    <div className="h-11 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                    <div className="h-11 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                    <div className="h-28 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                    <div className="h-10 w-32 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                </div>
            </div>

            <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-100 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900/50">
                    <div className="h-7 w-56 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="mt-2 h-3 w-80 max-w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="px-5 py-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="h-5 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                <div className="h-6 w-14 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            </div>
                            <div className="mb-3 h-5 w-32 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="h-16 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="h-10 w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
        </div>
    );
}

async function ReportEditDataSection({ sessionId }: { sessionId: string }) {
    // 세션 리포트 상세 + 코치 목록을 병렬 조회
    const [report, coaches] = await Promise.all([
        getSessionReport(sessionId),
        getCoaches(),
    ]);

    // 세션이 없으면 404
    if (!report) notFound();

    return <ReportEditClient report={report} coaches={coaches} />;
}

export default async function AdminReportEditPage({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}) {
    const { sessionId } = await params;

    return (
        <Suspense fallback={<ReportEditLoadingFallback />}>
            <ReportEditDataSection sessionId={sessionId} />
        </Suspense>
    );
}
