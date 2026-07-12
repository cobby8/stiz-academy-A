import { getCachedAdminGalleryPayload } from "@/lib/adminReadPayloads";
import { createAdminTiming, requireTimedAdmin, timedJson } from "@/lib/adminTiming";

export const dynamic = "force-dynamic";

export async function GET() {
    const timing = createAdminTiming("admin-gallery");

    try {
        await requireTimedAdmin(timing);
    } catch {
        return timedJson(timing, { error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await timing.measure("data", () => getCachedAdminGalleryPayload());

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
