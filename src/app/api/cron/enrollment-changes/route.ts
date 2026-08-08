import { NextRequest, NextResponse } from "next/server";
import { applyDueEnrollmentChanges } from "@/lib/enrollment/admin-change-request";

export const dynamic = "force-dynamic";

/**
 * 승인된 수강 변경을 적용일에 실제로 반영한다(매일 KST 00:10).
 *
 * 승인은 "예약"이다. 원장이 8월에 승인해도 반 이동은 9월 1일에 일어나야
 * 8월 남은 수업의 출석부와 청구가 어긋나지 않는다.
 * 이미 반영한 건은 건너뛰므로 두 번 실행돼도 안전하다.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (
    process.env.NODE_ENV !== "development" &&
    (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const applied = await applyDueEnrollmentChanges();
  return NextResponse.json({ ok: true, applied });
}
