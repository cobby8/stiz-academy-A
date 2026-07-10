/**
 * 체험수업 CRM 관리자 페이지 — 서버 컴포넌트
 * - 30초 ISR로 캐싱 (관리자 페이지 표준)
 * - getTrialLeads()와 getTrialStats()로 초기 데이터 조회 후 클라이언트에 전달
 */
import { Suspense } from "react";
import { getTrialLeads, getTrialStats } from "@/lib/queries";
import TrialCrmClient from "./TrialCrmClient";

export const revalidate = 30;

function TrialCrmLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-80 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-11 w-36 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {Array.from({ length: 7 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-28 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
            <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-8 w-20 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
            <div className="grid gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

async function TrialCrmDataSection() {
    // 화면 읽기 단계에서는 DB 구조 확인을 생략하고, 등록/수정 같은 쓰기 작업에서만 보장한다.
    const [leads, stats] = await Promise.all([
        getTrialLeads(),
        getTrialStats(),
    ]);

    return <TrialCrmClient initialLeads={leads} initialStats={stats} />;
}

export default function TrialCrmPage() {
    return (
        <Suspense fallback={<TrialCrmLoadingFallback />}>
            <TrialCrmDataSection />
        </Suspense>
    );
}
