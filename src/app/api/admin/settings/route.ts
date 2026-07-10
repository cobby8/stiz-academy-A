import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAcademySettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const settings = await getAcademySettings();

        return NextResponse.json(
            { settings, fetchError: false },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/settings] failed:", error);
        return NextResponse.json(
            { settings: null, fetchError: true },
            { headers: { "Cache-Control": "no-store" } },
        );
    }
}
