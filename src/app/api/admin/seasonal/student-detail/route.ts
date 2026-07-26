import { NextResponse } from "next/server";
import { getSeasonalStudentDetail } from "@/lib/seasonal/student-detail";

export const dynamic = "force-dynamic";

// 방학특강 수강생 상세(공통 모달). requireAdmin은 라이브러리에서 강제.
export async function GET(request: Request) {
  try {
    const applicationId = new URL(request.url).searchParams.get("applicationId") ?? "";
    const detail = await getSeasonalStudentDetail(applicationId);
    if (!detail) return NextResponse.json({ error: "학생 정보를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ detail }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[student-detail GET]", e);
    return NextResponse.json({ error: "불러오지 못했습니다." }, { status: 500 });
  }
}
