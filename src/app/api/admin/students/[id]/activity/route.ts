import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getStudentActivity } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const data = await getStudentActivity(id);

    if (!data) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(
        { data },
        {
            headers: {
                "Cache-Control": "no-store",
            },
        },
    );
}
