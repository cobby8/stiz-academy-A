import { NextResponse } from "next/server";
import { incrementalDispatch, type DispatchDirection } from "@/lib/seasonal/shuttle-optimize";

export const dynamic = "force-dynamic";

// 방학특강 셔틀 증분 재배차(Phase 2b) — 저장 노선 순서를 유지한 채 신규·복귀·위치변경만 끼워넣는다.
// requireAdmin은 엔진(incrementalDispatch)에서 강제한다. 저장본이 없으면 엔진이 전체 재최적화로 폴백한다.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { direction?: string; date?: string | null };
    const direction: DispatchDirection = body.direction === "DROPOFF" ? "DROPOFF" : "PICKUP";
    const suggestion = await incrementalDispatch({ direction, date: body.date ?? null });
    return NextResponse.json(suggestion, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[dispatch/increment POST]", e);
    return NextResponse.json({ error: "증분 재배차를 만들지 못했습니다." }, { status: 500 });
  }
}
