import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getCachedAdminStudentsPayload } from "@/lib/adminReadPayloads";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const limitParam = request.nextUrl.searchParams.get("limit");
        const limit = limitParam ? Number(limitParam) : undefined;
        const payload = await getCachedAdminStudentsPayload(limit);

        return NextResponse.json(
            payload,
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/students] failed:", error);
        return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
    }
}
