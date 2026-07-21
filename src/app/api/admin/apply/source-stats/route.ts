import { getCachedAdminApplySourceStatsPayload } from "@/lib/adminReadPayloads";
import { createAdminTiming, requireTimedAdmin, timedJson } from "@/lib/adminTiming";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const SOURCE_STATS_CACHE_HEADERS = {
    "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
};

type SourceStatsRange = "ALL" | "30D" | "THIS_MONTH";

function normalizeRange(value: string | null): SourceStatsRange {
    if (value === "ALL" || value === "30D" || value === "THIS_MONTH") return value;
    return "30D";
}

export async function GET(request: NextRequest) {
    const timing = createAdminTiming("admin-apply-source-stats");

    try {
        await requireTimedAdmin(timing);
    } catch {
        return timedJson(timing, { error: "Authentication required" }, { status: 401 });
    }

    try {
        const range = normalizeRange(request.nextUrl.searchParams.get("range"));
        const payload = await timing.measure("data", () => getCachedAdminApplySourceStatsPayload(range));

        return timedJson(timing, payload, { headers: SOURCE_STATS_CACHE_HEADERS });
    } catch (error) {
        console.error("[api/admin/apply/source-stats] failed:", error);
        return timedJson(timing, { error: "Failed to load source stats" }, { status: 500 });
    }
}
