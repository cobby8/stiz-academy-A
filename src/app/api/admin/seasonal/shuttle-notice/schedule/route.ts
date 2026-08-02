import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { buildShuttleNoticePreviews, parentPhoneByRequestId } from "@/lib/seasonal/shuttleNotice";
import { scheduleMessages, listPending, cancelScheduled } from "@/lib/scheduled-message";

export const dynamic = "force-dynamic";

// 셔틀 등원시간 안내 문자 — 예약 발송 걸기/보기/취소.
//
// ⚠️ 예약을 거는 **지금 시점의 문안을 통째로 얼려** 저장한다.
//    발송 시각에 노선을 다시 읽어 만들면, 그 사이 노선이 바뀐 경우 원장이 검토한 것과
//    다른 문자가 학부모에게 나간다. 문자는 회수할 수 없다.

const BATCH_KEY = "seasonal-shuttle-notice";

function todaySeoul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** 'YYYY-MM-DD' + 'HH:MM'(KST) → UTC Date. 한국은 서머타임이 없어 고정 +09:00으로 안전하다. */
function seoulToUtc(date: string, hhmm: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const d = new Date(`${date}T${hhmm}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  try {
    await requireAdmin();
    const pending = await listPending(BATCH_KEY);
    return NextResponse.json({
      pending: pending.map((p) => ({
        id: p.id, label: p.label, sendAt: p.sendAt, body: p.body,
        recipientMasked: p.recipient.replace(/^(\d{3})\d+(\d{4})$/, "$1-****-$2"),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[shuttle-notice/schedule GET]", e);
    return NextResponse.json({ error: "예약 목록을 불러오지 못했습니다." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null) as
      { requestIds?: unknown; date?: unknown; time?: unknown } | null;

    const wanted = Array.isArray(body?.requestIds) ? body!.requestIds!.map(String) : null;
    if (!wanted?.length) return NextResponse.json({ error: "발송할 대상을 선택해주세요." }, { status: 400 });

    const date = typeof body?.date === "string" ? body.date : todaySeoul();
    const time = typeof body?.time === "string" ? body.time : "08:00";
    const sendAt = seoulToUtc(date, time);
    if (!sendAt) return NextResponse.json({ error: "발송 시각이 올바르지 않습니다." }, { status: 400 });
    if (sendAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "이미 지난 시각으로는 예약할 수 없습니다." }, { status: 400 });
    }

    const today = todaySeoul();
    const previews = await buildShuttleNoticePreviews(today);
    const phones = await parentPhoneByRequestId();
    const byId = new Map(previews.map((p) => [p.requestId, p]));

    const items = [] as { recipient: string; body: string; label: string; requestId: string }[];
    const skipped = [] as { label: string; reason: string }[];
    for (const rid of wanted) {
      const p = byId.get(rid);
      if (!p) { skipped.push({ label: rid, reason: "대상을 찾지 못했습니다." }); continue; }
      if (!p.sendable) { skipped.push({ label: p.studentName, reason: p.skipReason ?? "발송 불가" }); continue; }
      const phone = phones.get(rid);
      if (!phone) { skipped.push({ label: p.studentName, reason: "연락처가 없습니다." }); continue; }
      items.push({
        recipient: phone, body: p.message, label: p.studentName,
        // 같은 날 같은 학생에게는 한 번만 — 즉시 발송 버튼과도 키를 공유해 중복을 막는다.
        requestId: `shuttle-notice-${date}-${rid}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 128),
      });
    }

    const { scheduled } = await scheduleMessages({
      batchKey: BATCH_KEY, sendAt, purpose: "셔틀 등원시간 안내(예약)",
      createdBy: admin.appUserId ?? null, items,
    });
    return NextResponse.json({ scheduled, skipped, sendAt: sendAt.toISOString() });
  } catch (e) {
    console.error("[shuttle-notice/schedule POST]", e);
    return NextResponse.json({ error: "예약에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
    const { cancelled } = await cancelScheduled(BATCH_KEY);
    return NextResponse.json({ cancelled });
  } catch (e) {
    console.error("[shuttle-notice/schedule DELETE]", e);
    return NextResponse.json({ error: "예약 취소에 실패했습니다." }, { status: 500 });
  }
}
