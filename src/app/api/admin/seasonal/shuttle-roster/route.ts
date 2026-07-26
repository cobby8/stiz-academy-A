import { NextResponse } from "next/server";
import { getSeasonalShuttleRoster, updateShuttleRosterRow } from "@/lib/seasonal/shuttle-roster";

export const dynamic = "force-dynamic";

// 방학특강 셔틀 통합 명단 — 목록 조회(GET) / 인라인 편집 저장(PATCH). requireAdmin은 라이브러리에서 강제한다.
export async function GET() {
  try {
    const roster = await getSeasonalShuttleRoster();
    return NextResponse.json({ roster }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[shuttle-roster GET]", e);
    return NextResponse.json({ error: "명단을 불러오지 못했습니다." }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { requestId?: string; patch?: Record<string, unknown> } | null;
    if (!body?.requestId || !body.patch) {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }
    await updateShuttleRosterRow(body.requestId, body.patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[shuttle-roster PATCH]", e);
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}
