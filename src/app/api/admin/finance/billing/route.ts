import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getBillingTemplates, getPrograms } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const [templates, programs] = await Promise.all([
            getBillingTemplates(),
            getPrograms(),
        ]);

        return NextResponse.json(
            { templates, programs },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/finance/billing] failed:", error);
        return NextResponse.json({ error: "Failed to load billing templates" }, { status: 500 });
    }
}
