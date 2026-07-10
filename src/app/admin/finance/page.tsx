import { Suspense } from "react";
import { getPayments, getPaymentSummary } from "@/lib/queries";
import FinanceClient from "./FinanceClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function FinanceLoadingFallback() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
                <div>
                    <div className="h-8 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-64 rounded bg-gray-100 dark:bg-gray-800 animate-pulse mt-2" />
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-28 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    <div className="h-10 w-28 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    <div className="h-10 w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
            </div>
            <div className="flex items-center justify-center gap-4 mb-6">
                <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="h-7 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" aria-label={`${y}년 ${m}월 수납 로딩 중`} />
                <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-28 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
            <div className="overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="h-12 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 animate-pulse" />
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="grid grid-cols-5 gap-4 px-4 py-4">
                            <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

async function FinanceDataSection() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    // 수납 목록과 요약 통계만 먼저 조회하고, 학생 목록은 추가 폼을 열 때 불러온다.
    const [payments, summary] = await Promise.all([
        getPayments(y, m),
        getPaymentSummary(y, m),
    ]);
    return (
        <FinanceClient
            initialPayments={payments}
            initialYear={y}
            initialMonth={m}
            initialSummary={summary}
        />
    );
}

export default function AdminFinancePage() {
    return (
        <Suspense fallback={<FinanceLoadingFallback />}>
            <FinanceDataSection />
        </Suspense>
    );
}
