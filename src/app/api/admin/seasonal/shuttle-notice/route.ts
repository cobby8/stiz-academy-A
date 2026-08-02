import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { buildShuttleNoticePreviews, parentPhoneByRequestId } from "@/lib/seasonal/shuttleNotice";
import { sendManualSms } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

// 셔틀 등원시간 안내 문자 — GET(미리보기) / POST(발송).
//
// ⚠️ 실제 학부모에게 나가는 문자다. 되돌릴 수 없으므로 다음을 지킨다.
//   · 발송은 **원장이 화면에서 확인한 뒤 누르는 POST**로만 일어난다. 크론·자동 트리거 없음.
//   · **1인 1통**으로 보낸다. 여러 명을 한 통에 묶으면 다른 집 아이 이름·탑승 장소가
//     남의 학부모에게 노출된다(개인정보 유출).
//   · requestId로 멱등성을 준다 — 버튼을 두 번 눌러도 같은 날 같은 학생에게 두 번 가지 않는다.

function todaySeoul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export async function GET() {
  try {
    await requireAdmin();
    const today = todaySeoul();
    const previews = await buildShuttleNoticePreviews(today);
    return NextResponse.json({ today, previews }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[shuttle-notice GET]", e);
    return NextResponse.json({ error: "미리보기를 만들지 못했습니다." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null) as { requestIds?: unknown } | null;
    // 화면이 "지금 보고 있는 목록"을 명시적으로 보내야 발송한다.
    // 서버가 알아서 전원에게 보내면, 원장이 본 화면과 실제 발송 대상이 어긋날 수 있다.
    const wanted = Array.isArray(body?.requestIds) ? body!.requestIds!.map(String) : null;
    if (!wanted || wanted.length === 0) {
      return NextResponse.json({ error: "발송할 대상을 선택해주세요." }, { status: 400 });
    }

    const today = todaySeoul();
    const previews = await buildShuttleNoticePreviews(today);
    const phones = await parentPhoneByRequestId();
    const byId = new Map(previews.map((p) => [p.requestId, p]));

    const results: { studentName: string; ok: boolean; reason?: string }[] = [];
    for (const rid of wanted) {
      const p = byId.get(rid);
      if (!p) { results.push({ studentName: rid, ok: false, reason: "대상을 찾지 못했습니다." }); continue; }
      if (!p.sendable) { results.push({ studentName: p.studentName, ok: false, reason: p.skipReason }); continue; }
      const phone = phones.get(rid);
      if (!phone) { results.push({ studentName: p.studentName, ok: false, reason: "연락처가 없습니다." }); continue; }
      try {
        // 같은 날 같은 학생에게는 한 번만 나간다(버튼 중복 클릭 방어).
        const r = await sendManualSms([phone], p.message, {
          requestId: `shuttle-notice-${today}-${rid}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 128),
          purpose: "셔틀 등원시간 안내",
          reason: "방학특강 셔틀 요일별 등원시간 안내",
          audienceScope: "EXTERNAL",
        });
        const ok = r.success > 0;
        results.push({
          studentName: p.studentName, ok,
          reason: ok ? undefined : (r.results?.[0]?.reason ?? "발송에 실패했습니다."),
        });
      } catch (e) {
        results.push({
          studentName: p.studentName, ok: false,
          reason: e instanceof Error ? e.message : "발송에 실패했습니다.",
        });
      }
    }

    const success = results.filter((r) => r.ok).length;
    return NextResponse.json({ total: results.length, success, failed: results.length - success, results });
  } catch (e) {
    console.error("[shuttle-notice POST]", e);
    return NextResponse.json({ error: "발송에 실패했습니다." }, { status: 500 });
  }
}
