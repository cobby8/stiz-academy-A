import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getClassCapacityInfo, getClasses, getWaitlistAll } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const [waitlist, capacityInfo, classes] = await Promise.all([
            getWaitlistAll(),
            getClassCapacityInfo(),
            getClasses(),
        ]);

        return NextResponse.json(
            { waitlist, capacityInfo, classes },
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
