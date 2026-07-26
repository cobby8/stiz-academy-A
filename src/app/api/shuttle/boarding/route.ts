import { NextResponse } from "next/server";
import { resolveRunToken, getBoardingMap, setBoarding, type BoardingStatus } from "@/lib/seasonal/shuttleRun";

export const dynamic = "force-dynamic";

// 기사님 탑승 체크 — 로그인 없이 유효 토큰으로만 접근한다(토큰이 관리자 인증을 대신).
// GET  ?token=  → 현재 탑승 상태 맵
// POST { token, shuttleRequestId, status } → 상태 저장(status 없으면 대기로 되돌림)

export async function GET(request: Request) {
  const url = new URL(request.url);
  const run = await resolveRunToken(url.searchParams.get("token") ?? "");
  if (!run) return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
  const boarding = await getBoardingMap(run.date, run.direction);
  return NextResponse.json({ boarding }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      token?: string; shuttleRequestId?: string; status?: string | null; studentName?: string | null;
    } | null;
    const run = await resolveRunToken(body?.token ?? "");
    if (!run) return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
    if (!body?.shuttleRequestId) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    const status: BoardingStatus | null = body.status === "BOARDED" ? "BOARDED" : body.status === "NOSHOW" ? "NOSHOW" : null;
    await setBoarding({
      date: run.date, direction: run.direction, shuttleRequestId: body.shuttleRequestId,
      status, studentName: body.studentName ?? null, via: "driver",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[shuttle/boarding POST]", e);
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}
