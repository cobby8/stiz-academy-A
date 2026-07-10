import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { ACADEMY_SETTINGS_CACHE_TAG, getAcademySettings, getAnnualEvents } from "@/lib/queries";

export const dynamic = "force-dynamic";

const getCachedAnnualPayload = unstable_cache(
    async () => {
        const [events, settings] = await Promise.all([
            getAnnualEvents(),
            getAcademySettings(),
        ]);

        return {
            events,
            initialIcsUrl: settings?.googleCalendarIcsUrl || "",
        };
    },
    ["admin-annual-v1"],
    { revalidate: 60, tags: ["admin-annual", ACADEMY_SETTINGS_CACHE_TAG] },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await getCachedAnnualPayload();

        return NextResponse.json(
            payload,
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/annual] failed:", error);
        return NextResponse.json({ error: "Failed to load annual events" }, { status: 500 });
    }
}
