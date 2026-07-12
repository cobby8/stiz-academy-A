import { getCachedAdminDashboardPayload } from "@/lib/adminReadPayloads";
import { createAdminTiming, requireTimedAdmin, timedJson } from "@/lib/adminTiming";

const ADMIN_DASHBOARD_CACHE_SECONDS = 300;
const ADMIN_DASHBOARD_CACHE_HEADERS = {
    "Cache-Control": `private, max-age=60, stale-while-revalidate=${ADMIN_DASHBOARD_CACHE_SECONDS}`,
};

export async function GET() {
    const timing = createAdminTiming("admin-dashboard");

    try {
        await requireTimedAdmin(timing);
    } catch {
        return timedJson(timing, { error: "Authentication required" }, { status: 401 });
    }

    try {
        const data = await timing.measure("data", () => getCachedAdminDashboardPayload());

        return timedJson(timing, data, { headers: ADMIN_DASHBOARD_CACHE_HEADERS });
    } catch (error) {
        console.error("[api/admin/dashboard] failed:", error);
        return timedJson(timing, { error: "Failed to load dashboard" }, { status: 500 });
    }
}
