import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getSmsTemplates } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const templates = await getSmsTemplates();

        return NextResponse.json(
            { templates },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/sms/templates] failed:", error);
        return NextResponse.json({ error: "Failed to load SMS templates" }, { status: 500 });
    }
}
