import { NextResponse } from "next/server";
import { suggestDispatch, type DispatchDirection } from "@/lib/seasonal/shuttle-optimize";

export const dynamic = "force-dynamic";

// 방학특강 셔틀 노선 자동 제안. requireAdmin은 엔진에서 강제한다.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { direction?: string; classStart?: string | null; capacity?: number };
    const direction: DispatchDirection = body.direction === "DROPOFF" ? "DROPOFF" : "PICKUP";
    const suggestion = await suggestDispatch({ direction, classStart: body.classStart ?? null, capacity: body.capacity });
    return NextResponse.json(suggestion, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[dispatch POST]", e);
    return NextResponse.json({ error: "노선 제안을 만들지 못했습니다." }, { status: 500 });
  }
}
