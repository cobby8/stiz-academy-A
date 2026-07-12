import { NextRequest } from "next/server";
import { getCachedAdminStudentsPayload } from "@/lib/adminReadPayloads";
import { createAdminTiming, requireTimedAdmin, timedJson } from "@/lib/adminTiming";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const timing = createAdminTiming("admin-students");

    try {
        await requireTimedAdmin(timing);
    } catch {
        return timedJson(timing, { error: "Authentication required" }, { status: 401 });
    }

    try {
        const limitParam = request.nextUrl.searchParams.get("limit");
        const limit = limitParam ? Number(limitParam) : undefined;
        const payload = await timing.measure("data", () => getCachedAdminStudentsPayload(limit));

        return timedJson(
            timing,
            payload,
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/students] failed:", error);
        return timedJson(timing, { error: "Failed to load students" }, { status: 500 });
    }
}
