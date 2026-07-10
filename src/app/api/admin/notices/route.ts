import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getClasses, getNotices } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const [notices, classes] = await Promise.all([
            getNotices({ limit: 100 }),
            getClasses(),
        ]);

        return NextResponse.json(
            { notices, classes },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/notices] failed:", error);
        return NextResponse.json({ error: "Failed to load notices" }, { status: 500 });
    }
}
