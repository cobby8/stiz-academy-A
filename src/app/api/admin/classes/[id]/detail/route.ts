import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getClassWithStudents, getCoaches, getSessionsByClass } from "@/lib/queries";

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

    try {
        const { id } = await params;
        const [classData, sessions, coaches] = await Promise.all([
            getClassWithStudents(id),
            getSessionsByClass(id),
            getCoaches(),
        ]);

        if (!classData) {
            return NextResponse.json({ error: "Class not found" }, { status: 404 });
        }

        return NextResponse.json(
            { classData, sessions, coaches },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        console.error("[api/admin/classes/detail] failed:", error);
        return NextResponse.json({ error: "Failed to load class detail" }, { status: 500 });
    }
}
