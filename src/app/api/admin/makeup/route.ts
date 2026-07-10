import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getClasses, getMakeupSessions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const [sessions, classes] = await Promise.all([
            getMakeupSessions(),
            getClasses(),
        ]);

        return NextResponse.json(
            { sessions, classes },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/makeup] failed:", error);
        return NextResponse.json({ error: "Failed to load makeup sessions" }, { status: 500 });
    }
}
