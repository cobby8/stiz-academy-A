import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getPrograms } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const programs = await getPrograms();

        return NextResponse.json(
            { programs },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/programs] failed:", error);
        return NextResponse.json({ error: "Failed to load programs" }, { status: 500 });
    }
}
