import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { getClasses, getPrograms } from "@/lib/queries";

export const dynamic = "force-dynamic";

const getCachedClassesPayload = unstable_cache(
    async () => {
        const [programs, classes] = await Promise.all([
            getPrograms(),
            getClasses(),
        ]);

        return { programs, classes };
    },
    ["admin-classes-v1"],
    { revalidate: 60, tags: ["admin-classes", "admin-programs"] },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await getCachedClassesPayload();

        return NextResponse.json(
            payload,
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[api/admin/classes] failed:", error);
        return NextResponse.json({ error: "Failed to load classes" }, { status: 500 });
    }
}
