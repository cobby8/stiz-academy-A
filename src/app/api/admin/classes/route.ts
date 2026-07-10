import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getClasses, getPrograms } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const [programs, classes] = await Promise.all([
            getPrograms(),
            getClasses(),
        ]);

        return NextResponse.json(
            { programs, classes },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/classes] failed:", error);
        return NextResponse.json({ error: "Failed to load classes" }, { status: 500 });
    }
}
