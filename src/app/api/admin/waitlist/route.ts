import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { getClassCapacityInfo, getClasses, getWaitlistAll } from "@/lib/queries";

export const dynamic = "force-dynamic";

const getCachedWaitlistPayload = unstable_cache(
    async () => {
        const [waitlist, capacityInfo, classes] = await Promise.all([
            getWaitlistAll(),
            getClassCapacityInfo(),
            getClasses(),
        ]);

        return { waitlist, capacityInfo, classes };
    },
    ["admin-waitlist-v1"],
    { revalidate: 30, tags: ["admin-waitlist", "admin-classes", "admin-students"] },
);

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await getCachedWaitlistPayload();

        return NextResponse.json(
            payload,
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/waitlist] failed:", error);
        return NextResponse.json({ error: "Failed to load waitlist" }, { status: 500 });
    }
}
