import { getCachedAdminStatsPayload } from "@/lib/adminReadPayloads";
import { createAdminTiming, requireTimedAdmin, timedJson } from "@/lib/adminTiming";

const STATS_CACHE_HEADERS = {
    "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
};

export async function GET() {
    const timing = createAdminTiming("admin-stats");

    try {
        await requireTimedAdmin(timing);
    } catch {
        return timedJson(timing, { error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await timing.measure("data", () => getCachedAdminStatsPayload());
        return timedJson(timing, payload, { headers: STATS_CACHE_HEADERS });
    } catch (error) {
        console.error("[api/admin/stats] failed:", error);
        return timedJson(timing, { error: "Failed to load stats" }, { status: 500 });
    }
}
