import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAcademySettings, getAnnualEvents } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const [events, settings] = await Promise.all([
            getAnnualEvents(),
            getAcademySettings(),
        ]);

        return NextResponse.json(
            {
                events,
                initialIcsUrl: settings?.googleCalendarIcsUrl || "",
            },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/annual] failed:", error);
        return NextResponse.json({ error: "Failed to load annual events" }, { status: 500 });
    }
}
