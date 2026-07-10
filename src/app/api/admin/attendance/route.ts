import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAttendanceByDateAndClass, getClasses } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");

    if (!classId && !date) {
        try {
            const classes = await getClasses();
            return NextResponse.json(
                { classes },
                { headers: { "Cache-Control": "no-store" } },
            );
        } catch (error) {
            console.error("[api/admin/attendance] classes failed:", error);
            return NextResponse.json({ error: "Failed to load classes" }, { status: 500 });
        }
    }

    if (!classId || !date) {
        return NextResponse.json({ error: "classId and date required" }, { status: 400 });
    }

    try {
        const data = await getAttendanceByDateAndClass(date, classId);
        return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[api/admin/attendance] detail failed:", error);
        return NextResponse.json({ error: "Failed to load attendance" }, { status: 500 });
    }
}
