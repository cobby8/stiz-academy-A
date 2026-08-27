import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { deleteRegularDispatchRoute, getSavedRegularDispatchRoute, saveRegularDispatchRoute } from "@/lib/regular/regularDispatchRoute";
import { validateRegularDispatchVehicles } from "@/lib/regular/regularDispatchPayload";
import { isServiceMonth } from "@/lib/regular/serviceMonth";

export const dynamic = "force-dynamic";

// 저장된 정규 배차 노선 — GET(조회) / POST(저장·덮어쓰기).
// RouteSection 은 date 파라미터 자리에 요일 문자열("Mon" 등)을 넣어 호출한다.

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const dayOfWeek = url.searchParams.get("date") ?? ""; // RouteSection 은 date=요일 로 보낸다
    const direction = url.searchParams.get("direction") ?? "PICKUP";
    const serviceMonth = url.searchParams.get("serviceMonth") ?? undefined;
    if (serviceMonth != null && !isServiceMonth(serviceMonth)) {
      return NextResponse.json({ error: "적용 월 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const saved = await getSavedRegularDispatchRoute(dayOfWeek, direction, serviceMonth);
    return NextResponse.json({ saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[regular dispatch/saved GET]", e);
    return NextResponse.json({ error: "저장된 노선을 불러오지 못했습니다." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      date?: string; direction?: string; vehicles?: unknown[]; classStart?: string | null; classEnd?: string | null; serviceMonth?: string;
    } | null;
    if (!body?.date || !body.direction || !Array.isArray(body.vehicles)) {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }
    if (!(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].includes(body.date))
      || !(["PICKUP", "DROPOFF"].includes(body.direction))
      || (body.serviceMonth != null && !isServiceMonth(body.serviceMonth))
      || ![body.classStart, body.classEnd].every((value) => value == null || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))) {
      return NextResponse.json({ error: "요일·방향·시각·적용 월 형식이 올바르지 않습니다." }, { status: 400 });
    }
    let vehicles: unknown[];
    try { vehicles = validateRegularDispatchVehicles(body.vehicles); }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
    const { savedAt } = await saveRegularDispatchRoute({
      dayOfWeek: body.date, direction: body.direction, vehicles,
      serviceMonth: body.serviceMonth,
      classStart: body.classStart ?? null, classEnd: body.classEnd ?? null,
    });
    return NextResponse.json({ ok: true, savedAt });
  } catch (e) {
    console.error("[regular dispatch/saved POST]", e);
    const msg = String((e as { message?: string })?.message ?? "");
    const status = /원장|권한|로그인|인증|Unauthorized|Forbidden/i.test(msg) ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? msg : "노선을 저장하지 못했습니다." }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const serviceMonth = url.searchParams.get("serviceMonth") ?? undefined;
    if (serviceMonth != null && !isServiceMonth(serviceMonth)) {
      return NextResponse.json({ error: "적용 월 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const deleted = await deleteRegularDispatchRoute(
      url.searchParams.get("date") ?? "",
      url.searchParams.get("direction") ?? "",
      serviceMonth,
    );
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    console.error("[regular dispatch/saved DELETE]", e);
    const msg = String((e as { message?: string })?.message ?? "");
    return NextResponse.json({ error: msg || "저장 노선을 삭제하지 못했습니다." }, { status: 400 });
  }
}
