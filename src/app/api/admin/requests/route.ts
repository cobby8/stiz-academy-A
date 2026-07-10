import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAllRequests } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const requests = await getAllRequests();

        return NextResponse.json(
            { requests },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/requests] failed:", error);
        return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
    }
}
