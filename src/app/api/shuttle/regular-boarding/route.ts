import { NextResponse } from "next/server";
import { isRegularRunToken, setRegularBoarding, type BoardingStatus } from "@/lib/shuttle/regularRun";

export const dynamic = "force-dynamic";

// 정규 셔틀 탑승/미탑승 체크(기사님 화면). 로그인 없이 토큰으로 접근하므로, 유효한 정규 토큰인지 먼저 확인한다.
// 날짜는 서버가 '오늘(KST)'로 정한다(클라이언트 조작 방지).
function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { token?: string; rowId?: string; status?: BoardingStatus | null; studentName?: string | null }
      | null;
    const token = typeof body?.token === "string" ? body.token : "";
    const rowId = typeof body?.rowId === "string" ? body.rowId : "";
    if (!token || !rowId) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    if (!(await isRegularRunToken(token))) return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 403 });
    // 허용값 확장: BOARDED/NOSHOW/SELF(자차) + null(대기). 그 외는 null로 수렴.
    const status =
      body?.status === "BOARDED" || body?.status === "NOSHOW" || body?.status === "SELF" ? body.status : null;
    await setRegularBoarding({ date: todayKST(), rowId, status, studentName: body?.studentName ?? null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[regular-boarding POST]", e);
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}
