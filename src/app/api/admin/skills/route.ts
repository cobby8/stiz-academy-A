import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getStudentSkills, getSkillHistory } from "@/lib/queries";

/**
 * GET /api/admin/skills?studentId=xxx
 * 관리자 전용 — 원생의 최신 스킬 + 성장 이력을 JSON으로 반환
 * 클라이언트 컴포넌트에서 원생 선택 시 호출한다
 */
export async function GET(request: NextRequest) {
    try {
        // 관리자 인증 확인
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    }

    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) {
        return NextResponse.json({ error: "studentId 필요" }, { status: 400 });
    }

    // 최신 스킬과 전체 이력을 병렬 조회
    const [skills, history] = await Promise.all([
        getStudentSkills(studentId),
        getSkillHistory(studentId),
    ]);

    return NextResponse.json({ skills, history });
}
