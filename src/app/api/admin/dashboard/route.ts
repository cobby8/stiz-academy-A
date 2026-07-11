import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getCachedAdminDashboardPayload } from "@/lib/adminReadPayloads";

const ADMIN_DASHBOARD_CACHE_SECONDS = 300;
const ADMIN_DASHBOARD_CACHE_HEADERS = {
    "Cache-Control": `private, max-age=60, stale-while-revalidate=${ADMIN_DASHBOARD_CACHE_SECONDS}`,
};

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const data = await getCachedAdminDashboardPayload();

        return NextResponse.json(data, { headers: ADMIN_DASHBOARD_CACHE_HEADERS });
    } catch (error) {
        console.error("[api/admin/dashboard] failed:", error);
        return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
    }
}
