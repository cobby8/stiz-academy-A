import { NextRequest, NextResponse } from "next/server";
import { getAttendanceByDateAndClass } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    // 인증 체크: 로그인한 관리자만 출결 데이터 조회 가능
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");

    if (!classId || !date) {
        return NextResponse.json({ error: "classId and date required" }, { status: 400 });
    }

    const data = await getAttendanceByDateAndClass(date, classId);
    return NextResponse.json(data);
}
