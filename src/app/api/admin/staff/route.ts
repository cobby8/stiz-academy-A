import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAllCoaches, getStaffInvitations, getStaffUsers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const [staffUsers, coaches, invitations] = await Promise.all([
            getStaffUsers(),
            getAllCoaches(),
            getStaffInvitations(),
        ]);

        return NextResponse.json(
            { staffUsers, coaches, invitations },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/staff] failed:", error);
        return NextResponse.json({ error: "Failed to load staff" }, { status: 500 });
    }
}
