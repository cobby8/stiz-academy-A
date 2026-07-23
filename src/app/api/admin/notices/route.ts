import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import {
    getCachedAdminNoticesPagePayload,
    getCachedAdminNoticesPayload,
} from "@/lib/adminReadPayloads";

export const dynamic = "force-dynamic";

function parsePositiveInt(value: string | null, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseOffset(value: string | null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export async function GET(request: Request) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const limit = parsePositiveInt(url.searchParams.get("limit"), 30);
        const offset = parseOffset(url.searchParams.get("offset"));
        const noticesOnly = url.searchParams.get("noticesOnly") === "1";
        const payload = noticesOnly
            ? await getCachedAdminNoticesPagePayload({ limit, offset })
            : await getCachedAdminNoticesPayload({ limit, offset });

        return NextResponse.json(
            payload,
            { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
        );
    } catch (error) {
        console.error("[api/admin/notices] failed:", error);
        return NextResponse.json({ error: "Failed to load notices" }, { status: 500 });
    }
}
