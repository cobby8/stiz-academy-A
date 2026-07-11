import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getCachedAdminRequestsPayload } from "@/lib/adminReadPayloads";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await getCachedAdminRequestsPayload();

        return NextResponse.json(
            payload,
            { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
        );
    } catch (error) {
        console.error("[api/admin/requests] failed:", error);
        return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
    }
}
