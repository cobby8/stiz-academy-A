import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { getClasses, getEnrollApplications, getEnrollApplicationStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

const getCachedApplyPayload = unstable_cache(
    async () => {
        const [applications, stats, classes] = await Promise.all([
            getEnrollApplications(),
            getEnrollApplicationStats(),
            getClasses(),
        ]);

        return { applications, stats, classes };
    },
    ["admin-apply-v1"],
    { revalidate: 30, tags: ["admin-apply", "admin-classes"] },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await getCachedApplyPayload();

        return NextResponse.json(
            payload,
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/apply] failed:", error);
        return NextResponse.json({ error: "Failed to load applications" }, { status: 500 });
    }
}
