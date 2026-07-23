import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getCachedAdminRequestsPayload } from "@/lib/adminReadPayloads";

export const dynamic = "force-dynamic";

const REQUEST_STATUSES = new Set(["PENDING", "CONFIRMED", "COMPLETED", "REJECTED"]);

function readPositiveNumber(value: string | null) {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

export async function GET(request: Request) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const payload = await getCachedAdminRequestsPayload({
            statusFilter: status && REQUEST_STATUSES.has(status) ? status : undefined,
            limit: readPositiveNumber(searchParams.get("limit")),
            offset: readPositiveNumber(searchParams.get("offset")),
        });

        return NextResponse.json(
            payload,
            { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
        );
    } catch (error) {
        console.error("[api/admin/requests] failed:", error);
        return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
    }
}
