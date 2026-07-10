import { NextResponse } from "next/server";
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

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
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

        return NextResponse.json(
            {
                monthlyRevenue,
                monthlyAttendance,
                enrollmentTrend,
                classCapacity,
                trialStats,
                coachWorkload,
                collectionRate,
            },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/stats] failed:", error);
        return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
    }
}
