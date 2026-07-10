import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import {
    getClassCapacityInfo,
    getCoachWorkload,
    getEnrollmentTrend,
    getMonthlyAttendanceRate,
    getMonthlyRevenue,
    getPaymentCollectionRate,
    getTrialStats,
} from "@/lib/queries";

const STATS_CACHE_HEADERS = {
    "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
};

const getCachedStats = unstable_cache(
    async () => {
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

        return {
            monthlyRevenue,
            monthlyAttendance,
            enrollmentTrend,
            classCapacity,
            trialStats,
            coachWorkload,
            collectionRate,
        };
    },
    ["admin-stats-v1"],
    { revalidate: 60, tags: ["admin-stats"] },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        return NextResponse.json(await getCachedStats(), { headers: STATS_CACHE_HEADERS });
    } catch (error) {
        console.error("[api/admin/stats] failed:", error);
        return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
    }
}
