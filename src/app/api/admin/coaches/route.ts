import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { getCoaches } from "@/lib/queries";

export const dynamic = "force-dynamic";

const getCachedCoaches = unstable_cache(
    () => getCoaches(),
    ["admin-coaches-v1"],
    { revalidate: 60, tags: ["admin-coaches"] },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const coaches = await getCachedCoaches();

        return NextResponse.json(
            { coaches },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/coaches] failed:", error);
        return NextResponse.json({ error: "Failed to load coaches" }, { status: 500 });
    }
}
