import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { routeFixedOrderWithTmap } from "@/lib/shuttle/tmap";

export const dynamic = "force-dynamic";

// 사용자가 정한 순서 그대로 실도로 경로·시간을 다시 계산한다(재정렬 없음).
// 방학특강 reroute 와 동일한 순수 기하 계산 — 명단 출처와 무관해 로직을 그대로 복제한다.
type LL = { lat: number; lng: number };
function pt(v: unknown): LL | null {
  const o = v as { lat?: unknown; lng?: unknown } | null;
  const lat = Number(o?.lat), lng = Number(o?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null) as { start?: unknown; end?: unknown; waypoints?: unknown[] } | null;
    const start = pt(body?.start), end = pt(body?.end);
    const waypoints = Array.isArray(body?.waypoints) ? body!.waypoints!.map(pt).filter((x): x is LL => x != null) : [];
    if (!start || !end || waypoints.length === 0) {
      return NextResponse.json({ error: "좌표가 올바르지 않습니다." }, { status: 400 });
    }
    try {
      const r = await routeFixedOrderWithTmap({ start, end, waypoints });
      return NextResponse.json({
        path: r.path,
        totalMinutes: r.totalTime > 0 ? Math.round(r.totalTime / 60) : null,
        totalKm: r.totalDistance > 0 ? Math.round(r.totalDistance / 100) / 10 : null,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      // T맵 실패는 오류가 아니라 "직선 추정 유지" 신호로 내려보낸다.
      return NextResponse.json({ path: null }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch (e) {
    console.error("[regular dispatch/reroute POST]", e);
    return NextResponse.json({ error: "권한이 필요합니다." }, { status: 401 });
  }
}
