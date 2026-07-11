import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getCachedAdminSettingsPayload } from "@/lib/adminReadPayloads";

const SETTINGS_CACHE_HEADERS = {
    "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
};

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        return NextResponse.json(
            await getCachedAdminSettingsPayload(),
            { headers: SETTINGS_CACHE_HEADERS },
        );
    } catch (error) {
        console.error("[api/admin/settings] failed:", error);
        return NextResponse.json(
            { settings: null, fetchError: true },
            { headers: SETTINGS_CACHE_HEADERS },
        );
    }
}
