import { NextResponse } from "next/server";
import { suggestDispatch, type DispatchDirection } from "@/lib/seasonal/shuttle-optimize";

export const dynamic = "force-dynamic";

// 방학특강 셔틀 노선 자동 제안 — 날짜(요일 스케줄)·방향 기준. requireAdmin은 엔진에서 강제한다.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { direction?: string; date?: string | null };
    const direction: DispatchDirection = body.direction === "DROPOFF" ? "DROPOFF" : "PICKUP";
    const suggestion = await suggestDispatch({ direction, date: body.date ?? null });
    return NextResponse.json(suggestion, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[dispatch POST]", e);
    return NextResponse.json({ error: "노선 제안을 만들지 못했습니다." }, { status: 500 });
  }
}
