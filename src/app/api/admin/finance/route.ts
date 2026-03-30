import { NextRequest, NextResponse } from "next/server";
import { getPayments } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    // 인증 체크: 로그인한 사용자인지 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    }

    // 인가 체크: DB에서 role을 조회하여 ADMIN만 허용 (학부모 등 일반 사용자 차단)
    const rows = await prisma.$queryRawUnsafe<{ role: string }[]>(
        `SELECT role FROM "User" WHERE "authId" = $1 LIMIT 1`,
        user.id,
    );
    if (!rows.length || rows[0].role !== "ADMIN") {
        return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
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
