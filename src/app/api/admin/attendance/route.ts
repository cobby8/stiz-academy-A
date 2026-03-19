import { NextRequest, NextResponse } from "next/server";
import { getAttendanceByDateAndClass } from "@/lib/queries";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");

    if (!classId || !date) {
        return NextResponse.json({ error: "classId and date required" }, { status: 400 });
    }

    const data = await getAttendanceByDateAndClass(date, classId);
    return NextResponse.json(data);
}
