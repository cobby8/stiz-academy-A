import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getInstagramRuntimeStatus } from "@/lib/instagram";
import { getAcademySettings, getClasses, getGalleryPosts } from "@/lib/queries";
import { getPendingSocialPostDrafts } from "@/lib/socialDrafts";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const [posts, classes, settings, socialDrafts] = await Promise.all([
            getGalleryPosts({ limit: 100 }),
            getClasses(),
            getAcademySettings(),
            getPendingSocialPostDrafts(30),
        ]);
        const settingsData = settings as any;
        const instagramStatus = {
            profileUrl: settingsData?.instagramUrl ?? "",
            businessAccountId: settingsData?.instagramBusinessAccountId ?? "",
            autoPublishEnabled: settingsData?.instagramAutoPublishEnabled === true,
            ...getInstagramRuntimeStatus(settingsData?.instagramBusinessAccountId),
        };

        return NextResponse.json(
            { posts, classes, instagramStatus, socialDrafts },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/gallery] failed:", error);
        return NextResponse.json({ error: "Failed to load gallery data" }, { status: 500 });
    }
}
