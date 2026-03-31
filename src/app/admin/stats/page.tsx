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

// 서버 컴포넌트 — 모든 집계 함수를 병렬로 호출한 뒤 클라이언트에 전달
export default async function StatsPage() {
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
