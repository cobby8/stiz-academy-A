import { NextResponse } from "next/server";
import { importRegularShuttleFromSheet } from "@/lib/shuttle/regularImport";
import { isServiceMonth } from "@/lib/regular/serviceMonth";

export const dynamic = "force-dynamic";

// 정규 셔틀 운행리스트를 구글 시트에서 앱 DB로 가져온다(replace). requireAdmin은 라이브러리에서 강제.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { sheetUrl?: string; serviceMonth?: string } | null;
    if (typeof body?.sheetUrl !== "string" || body.sheetUrl.length > 500 || !isServiceMonth(body.serviceMonth)) {
      return NextResponse.json({ error: "시트 URL과 적용 월 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const result = await importRegularShuttleFromSheet(body.sheetUrl, body.serviceMonth);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[regular-import POST]", e);
    const msg = String((e as { message?: string })?.message ?? "");
    const status = /원장|권한|로그인|인증|Unauthorized|Forbidden/i.test(msg) ? 403 : 400;
    return NextResponse.json({ error: msg || "가져오지 못했습니다." }, { status });
  }
}
