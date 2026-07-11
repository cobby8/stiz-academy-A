import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getCachedAdminFeedbackPayload } from "@/lib/adminReadPayloads";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await getCachedAdminFeedbackPayload();

        return NextResponse.json(
            payload,
            { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
        );
    } catch (error) {
        console.error("[api/admin/feedback] failed:", error);
        return NextResponse.json({ error: "Failed to load feedbacks" }, { status: 500 });
    }
}
