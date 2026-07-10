import { Suspense } from "react";
import {
    getMonthlyRevenue,
    getMonthlyAttendanceRate,
    getEnrollmentTrend,
    getClassCapacityInfo,
    getTrialStats,
    getCoachWorkload,
    getPaymentCollectionRate,
} from "@/lib/queries";
import StatsClient from "./StatsClient";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

function StatsLoadingFallback() {
    return (
        <div className="mx-auto max-w-7xl space-y-8">
            <div>
                <div className="h-8 w-44 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-800"
                    >
                        <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        <div className="mt-3 h-8 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                        <div className="mt-2 h-4 w-32 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <div className="h-8 w-24 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-8 w-24 rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800"
                    >
                        <div className="mb-4 flex items-center gap-2">
                            <div className="h-6 w-6 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                            <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                        </div>
                        <div className="flex h-[220px] items-end gap-3">
                            {Array.from({ length: 8 }).map((_, barIndex) => (
                                <div
                                    key={barIndex}
                                    className="flex-1 rounded-t bg-gray-100 dark:bg-gray-700 animate-pulse"
                                    style={{ height: `${36 + ((barIndex * 17) % 58)}%` }}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// 서버 컴포넌트 — 모든 집계 함수를 병렬로 호출한 뒤 클라이언트에 전달
async function StatsDataSection() {
    // 7개 집계 함수를 동시에 실행하여 응답 시간 최소화
    const [
        monthlyRevenue,
        monthlyAttendance,
        enrollmentTrend,
        classCapacity,
        trialStats,
        coachWorkload,
        collectionRate,
    ] = await Promise.all([
        getMonthlyRevenue(12),
        getMonthlyAttendanceRate(12),
        getEnrollmentTrend(12),
        getClassCapacityInfo(),
        getTrialStats(),
        getCoachWorkload(),
        getPaymentCollectionRate(),
    ]);

    return (
        <StatsClient
            monthlyRevenue={monthlyRevenue}
            monthlyAttendance={monthlyAttendance}
            enrollmentTrend={enrollmentTrend}
            classCapacity={classCapacity}
            trialStats={trialStats}
            coachWorkload={coachWorkload}
            collectionRate={collectionRate}
        />
    );
}

export default function StatsPage() {
    return (
        <Suspense fallback={<StatsLoadingFallback />}>
            <StatsDataSection />
        </Suspense>
    );
}
