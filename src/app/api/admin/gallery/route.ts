import {
    getCachedAdminGalleryPayload,
    getCachedAdminGalleryPostsPagePayload,
} from "@/lib/adminReadPayloads";
import { createAdminTiming, requireTimedAdmin, timedJson } from "@/lib/adminTiming";

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
    const timing = createAdminTiming("admin-gallery");

    try {
        await requireTimedAdmin(timing);
    } catch {
        return timedJson(timing, { error: "Authentication required" }, { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const limit = parsePositiveInt(url.searchParams.get("limit"), 24);
        const offset = parseOffset(url.searchParams.get("offset"));
        const postsOnly = url.searchParams.get("postsOnly") === "1";
        const payload = await timing.measure("data", () =>
            postsOnly
                ? getCachedAdminGalleryPostsPagePayload({ limit, offset })
                : getCachedAdminGalleryPayload({ limit, offset }),
        );

        return timedJson(
            timing,
            payload,
            { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
        );
    } catch (error) {
        console.error("[api/admin/gallery] failed:", error);
        return timedJson(timing, { error: "Failed to load gallery data" }, { status: 500 });
    }
}
