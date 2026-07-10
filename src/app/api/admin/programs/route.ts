import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { getPrograms } from "@/lib/queries";

export const dynamic = "force-dynamic";

const getCachedPrograms = unstable_cache(
    () => getPrograms(),
    ["admin-programs-v1"],
    { revalidate: 60, tags: ["admin-programs"] },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const programs = await getCachedPrograms();

        return NextResponse.json(
            { programs },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/programs] failed:", error);
        return NextResponse.json({ error: "Failed to load programs" }, { status: 500 });
    }
}
