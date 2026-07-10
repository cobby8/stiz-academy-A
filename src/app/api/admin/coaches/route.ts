import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getCoaches } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const coaches = await getCoaches();

        return NextResponse.json(
            { coaches },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/coaches] failed:", error);
        return NextResponse.json({ error: "Failed to load coaches" }, { status: 500 });
    }
}
