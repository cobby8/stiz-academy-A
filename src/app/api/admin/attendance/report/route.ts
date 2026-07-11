import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getCachedAdminReportListPayload } from "@/lib/adminReadPayloads";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

    try {
        const payload = await getCachedAdminReportListPayload(limit);

        return NextResponse.json(
            payload,
            { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
        );
    } catch (error) {
        console.error("[api/admin/attendance/report] failed:", error);
        return NextResponse.json({ error: "Failed to load report sessions" }, { status: 500 });
    }
}
