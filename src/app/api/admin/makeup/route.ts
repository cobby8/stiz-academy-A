import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { getClasses, getMakeupSessions } from "@/lib/queries";

export const dynamic = "force-dynamic";

const getCachedMakeupPayload = unstable_cache(
    async () => {
        const [sessions, classes] = await Promise.all([
            getMakeupSessions(),
            getClasses(),
        ]);

        return { sessions, classes };
    },
    ["admin-makeup-v1"],
    { revalidate: 30, tags: ["admin-makeup", "admin-classes"] },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await getCachedMakeupPayload();

        return NextResponse.json(
            payload,
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/makeup] failed:", error);
        return NextResponse.json({ error: "Failed to load makeup sessions" }, { status: 500 });
    }
}
