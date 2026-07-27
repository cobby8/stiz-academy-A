import { NextResponse } from "next/server";
import { resolveRunToken, getBoardingMap, setBoarding, type BoardingStatus } from "@/lib/seasonal/shuttleRun";

export const dynamic = "force-dynamic";

// 기사님 탑승 체크 — 로그인 없이 유효 토큰으로만 접근한다(토큰이 관리자 인증을 대신).
// 링크는 날짜 단위라 등원·하원 상태를 모두 다룬다.
// GET  ?token=  → { boarding: { PICKUP, DROPOFF } }
// POST { token, direction, shuttleRequestId, status } → 그 방향의 상태 저장(status 없으면 대기)

function dir(v: unknown): "PICKUP" | "DROPOFF" | null { return v === "PICKUP" || v === "DROPOFF" ? v : null; }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const run = await resolveRunToken(url.searchParams.get("token") ?? "");
  if (!run) return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
  const [pickup, dropoff] = await Promise.all([getBoardingMap(run.date, "PICKUP"), getBoardingMap(run.date, "DROPOFF")]);
  return NextResponse.json({ boarding: { PICKUP: pickup, DROPOFF: dropoff } }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      token?: string; direction?: string; shuttleRequestId?: string; status?: string | null; studentName?: string | null;
    } | null;
    const run = await resolveRunToken(body?.token ?? "");
    if (!run) return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
    const direction = dir(body?.direction);
    if (!direction || !body?.shuttleRequestId) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    // 허용값 확장: BOARDED/NOSHOW/SELF(자차) + null(대기). 그 외는 null로 수렴.
    const status: BoardingStatus | null =
      body.status === "BOARDED" ? "BOARDED" : body.status === "NOSHOW" ? "NOSHOW" : body.status === "SELF" ? "SELF" : null;
    await setBoarding({
      date: run.date, direction, shuttleRequestId: body.shuttleRequestId,
      status, studentName: body.studentName ?? null, via: "driver",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[shuttle/boarding POST]", e);
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}
