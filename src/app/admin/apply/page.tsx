/**
 * 수강 신청 관리 페이지 — 서버 컴포넌트
 * - 30초 ISR 캐싱 (관리자 페이지 표준)
 * - 신청서 목록 + 통계 + 반 목록 + 설정을 병렬 조회 후 클라이언트에 전달
 */
import { Suspense } from "react";
import { getEnrollApplications, getEnrollApplicationStats, getClasses, getAcademySettings } from "@/lib/queries";
import ApplyAdminClient from "./ApplyAdminClient";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function ApplyLoadingFallback() {
    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-8 w-52 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-64 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="h-10 w-36 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>
            <div className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-28 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
            <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-36 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

async function ApplyDataSection() {
    // 신청서 생성 단계에서 테이블을 보장하므로, 목록 화면은 읽기 데이터만 빠르게 조회한다.
    const [applications, stats, classes, settings] = await Promise.all([
        getEnrollApplications(),
        getEnrollApplicationStats(),
        getClasses(),
        getAcademySettings().catch(() => ({} as any)),
    ]);

    return (
        <ApplyAdminClient
            initialApplications={applications}
            initialStats={stats}
            initialClasses={classes}
            initialSettings={{
                trialTitle: settings?.trialTitle || "체험수업 안내",
                trialContent: settings?.trialContent || null,
                trialFormUrl: settings?.trialFormUrl || null,
                enrollTitle: settings?.enrollTitle || "수강신청 안내",
                enrollContent: settings?.enrollContent || null,
                enrollFormUrl: settings?.enrollFormUrl || null,
                uniformFormUrl: settings?.uniformFormUrl || null,
                useBuiltInTrialForm: settings?.useBuiltInTrialForm ?? false,
                useBuiltInEnrollForm: settings?.useBuiltInEnrollForm ?? false,
            }}
        />
    );
}

export default function AdminApplyPage() {
    return (
        <Suspense fallback={<ApplyLoadingFallback />}>
            <ApplyDataSection />
        </Suspense>
    );
}
