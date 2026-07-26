import { NextResponse } from "next/server";
import { saveRegularStopOrder } from "@/lib/shuttle/regularImport";

export const dynamic = "force-dynamic";

// 정규 셔틀 정차 순서·도착시각 저장. requireAdmin은 라이브러리에서 강제.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { updates?: { id?: string; sortOrder?: number; arriveTime?: string | null }[] }
      | null;
    const updates = (body?.updates ?? [])
      .filter((u) => u && typeof u.id === "string" && typeof u.sortOrder === "number")
      .map((u) => ({ id: u.id as string, sortOrder: u.sortOrder as number, arriveTime: (u.arriveTime ?? null) as string | null }));
    if (updates.length === 0) return NextResponse.json({ error: "저장할 항목이 없습니다." }, { status: 400 });
    const result = await saveRegularStopOrder(updates);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[regular-order POST]", e);
    const msg = String((e as { message?: string })?.message ?? "");
    const status = /원장|권한|로그인|인증|Unauthorized|Forbidden/i.test(msg) ? 403 : 400;
    return NextResponse.json({ error: msg || "저장하지 못했습니다." }, { status });
  }
}
