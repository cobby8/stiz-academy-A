/**
 * GET /api/admin/trial-count — 새 체험 신청(NEW) 건수 반환
 * 사이드바 배지 표시용 (클라이언트 컴포넌트에서 fetch)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // 관리자 인증 확인
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            return NextResponse.json({ count: 0 }, { status: 401 });
        }
        const userRows = await prisma.$queryRawUnsafe<{ role: string }[]>(
            `SELECT role FROM "User" WHERE email = $1 LIMIT 1`, user.email
        );
        if (userRows.length === 0 || userRows[0].role !== "ADMIN") {
            return NextResponse.json({ count: 0 }, { status: 403 });
        }

        const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
            `SELECT COUNT(*)::int AS count FROM "TrialLead" WHERE status = 'NEW'`
        );
        return NextResponse.json({ count: rows[0]?.count ?? 0 });
    } catch {
        return NextResponse.json({ count: 0 });
    }
}
