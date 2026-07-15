import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getCachedAdminTrialPayload } from "@/lib/adminReadPayloads";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const limit = Number(request.nextUrl.searchParams.get("limit") || 50);
        const offset = Number(request.nextUrl.searchParams.get("offset") || 0);
        const payload = await getCachedAdminTrialPayload({ limit, offset });

        return NextResponse.json(
            payload,
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/trial] failed:", error);
        return NextResponse.json({ error: "Failed to load trial leads" }, { status: 500 });
    }
}
