import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getCachedAdminStatsPayload } from "@/lib/adminReadPayloads";

const STATS_CACHE_HEADERS = {
    "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
};

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        return NextResponse.json(await getCachedAdminStatsPayload(), { headers: STATS_CACHE_HEADERS });
    } catch (error) {
        console.error("[api/admin/stats] failed:", error);
        return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
    }
}
