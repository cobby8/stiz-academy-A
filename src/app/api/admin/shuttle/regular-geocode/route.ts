import { NextResponse } from "next/server";
import { saveRegularStopCoords } from "@/lib/shuttle/regularImport";

export const dynamic = "force-dynamic";

// 정류장 이름별 좌표(브라우저 카카오 SDK로 찾은 값)를 저장한다. requireAdmin은 라이브러리에서 강제.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { entries?: { stopName?: string; latitude?: number; longitude?: number }[] }
      | null;
    const entries = (body?.entries ?? [])
      .filter((e) => e && typeof e.stopName === "string" && typeof e.latitude === "number" && typeof e.longitude === "number")
      .map((e) => ({ stopName: e.stopName as string, latitude: e.latitude as number, longitude: e.longitude as number }));
    if (entries.length === 0) return NextResponse.json({ error: "저장할 좌표가 없습니다." }, { status: 400 });
    const result = await saveRegularStopCoords(entries);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[regular-geocode POST]", e);
    const msg = String((e as { message?: string })?.message ?? "");
    const status = /원장|권한|로그인|인증|Unauthorized|Forbidden/i.test(msg) ? 403 : 400;
    return NextResponse.json({ error: msg || "좌표를 저장하지 못했습니다." }, { status });
  }
}
