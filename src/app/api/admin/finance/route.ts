import { NextRequest } from "next/server";
import { getCachedAdminFinancePayload } from "@/lib/adminReadPayloads";
import { createAdminTiming, requireTimedAdmin, timedJson } from "@/lib/adminTiming";

const FINANCE_CACHE_HEADERS = {
    "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
};

export async function GET(request: NextRequest) {
    const timing = createAdminTiming("admin-finance");

    try {
        await requireTimedAdmin(timing);
    } catch {
        return timedJson(timing, { error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const year = parseInt(searchParams.get("year") || "");
    const month = parseInt(searchParams.get("month") || "");

    if (!year || !month) {
        return timedJson(timing, { error: "year and month required" }, { status: 400 });
    }

    try {
        const data = await timing.measure("data", () => getCachedAdminFinancePayload(year, month));

        return timedJson(
            timing,
            data,
            { headers: FINANCE_CACHE_HEADERS },
        );
    } catch (error) {
        console.error("[api/admin/finance] failed:", error);
        return timedJson(timing, { error: "Failed to load payments" }, { status: 500 });
    }
}
