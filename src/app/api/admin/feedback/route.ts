import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAllFeedbacks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const feedbacks = await getAllFeedbacks();

        return NextResponse.json(
            { feedbacks },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/feedback] failed:", error);
        return NextResponse.json({ error: "Failed to load feedbacks" }, { status: 500 });
    }
}
