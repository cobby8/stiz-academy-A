import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedParent } from "@/lib/auth-guard";
import {
  submitPaymentParentRequest,
  cancelPaymentParentRequest,
} from "@/lib/payments/parent-payment-request";

export const dynamic = "force-dynamic";

// 요청(submit) / 요청 취소(cancel) — body.action 으로 분기
export async function POST(request: NextRequest) {
  let parent;
  try {
    parent = await requireVerifiedParent();
  } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const result =
      body?.action === "cancel"
        ? await cancelPaymentParentRequest(parent.appUserId, String(body?.id ?? ""))
        : await submitPaymentParentRequest(parent.appUserId, body ?? {});
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/mypage/payment-request] POST failed:", error);
    return NextResponse.json({ error: "처리에 실패했습니다." }, { status: 500 });
  }
}
