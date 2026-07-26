import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getSavedDispatchRoute, saveDispatchRoute } from "@/lib/seasonal/dispatchRoute";

export const dynamic = "force-dynamic";

// 저장된 배차 노선 — GET(조회) / POST(저장·덮어쓰기). 저장은 라이브러리에서 requireAdmin을 강제한다.

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const direction = url.searchParams.get("direction") ?? "PICKUP";
    const saved = await getSavedDispatchRoute(date, direction);
    return NextResponse.json({ saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[dispatch/saved GET]", e);
    return NextResponse.json({ error: "저장된 노선을 불러오지 못했습니다." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      date?: string; direction?: string; vehicles?: unknown[]; classStart?: string | null; classEnd?: string | null;
    } | null;
    if (!body?.date || !body.direction || !Array.isArray(body.vehicles)) {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const { savedAt } = await saveDispatchRoute({
      date: body.date, direction: body.direction, vehicles: body.vehicles,
      classStart: body.classStart ?? null, classEnd: body.classEnd ?? null,
    });
    return NextResponse.json({ ok: true, savedAt });
  } catch (e) {
    console.error("[dispatch/saved POST]", e);
    const msg = String((e as { message?: string })?.message ?? "");
    const status = /원장|권한|로그인|인증|Unauthorized|Forbidden/i.test(msg) ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? msg : "노선을 저장하지 못했습니다." }, { status });
  }
}
