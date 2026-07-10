import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getTrialLeads, getTrialStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const [leads, stats] = await Promise.all([
            getTrialLeads(),
            getTrialStats(),
        ]);

        return NextResponse.json(
            { leads, stats },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/trial] failed:", error);
        return NextResponse.json({ error: "Failed to load trial leads" }, { status: 500 });
    }
}
