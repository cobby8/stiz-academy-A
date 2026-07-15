import { getCachedAdminApplyPayload } from "@/lib/adminReadPayloads";
import { createAdminTiming, requireTimedAdmin, timedJson } from "@/lib/adminTiming";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const timing = createAdminTiming("admin-apply");

    try {
        await requireTimedAdmin(timing);
    } catch {
        return timedJson(timing, { error: "Authentication required" }, { status: 401 });
    }

    try {
        const limit = Number(request.nextUrl.searchParams.get("limit") || 50);
        const offset = Number(request.nextUrl.searchParams.get("offset") || 0);
        const payload = await timing.measure("data", () => getCachedAdminApplyPayload({ limit, offset }));

        return timedJson(
            timing,
            payload,
            {
                headers: {
                    "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/apply] failed:", error);
        return timedJson(timing, { error: "Failed to load applications" }, { status: 500 });
    }
}
