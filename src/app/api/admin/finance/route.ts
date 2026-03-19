import { NextRequest, NextResponse } from "next/server";
import { getPayments } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    // 인증 체크: 로그인한 관리자만 수납 데이터 조회 가능
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const year = parseInt(searchParams.get("year") || "");
    const month = parseInt(searchParams.get("month") || "");

    if (!year || !month) {
        return NextResponse.json({ error: "year and month required" }, { status: 400 });
    }

    const data = await getPayments(year, month);
    return NextResponse.json(data);
}
