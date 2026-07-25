import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedParent } from "@/lib/auth-guard";
import { getParentSeasonalContext, requestParentMakeup } from "@/lib/seasonal/parent-makeup";

export const dynamic = "force-dynamic";

export async function GET() {
  let parent;
  try { parent = await requireVerifiedParent(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  try {
    return NextResponse.json(await getParentSeasonalContext(parent.appUserId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/mypage/seasonal-makeup] GET failed:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let parent;
  try { parent = await requireVerifiedParent(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid body" }, { status: 400 }); }
  if (!body?.enrollmentDateId || !body?.targetType) return NextResponse.json({ error: "필수 값이 없습니다." }, { status: 400 });
  try {
    const result = await requestParentMakeup(parent.appUserId, {
      enrollmentDateId: body.enrollmentDateId, targetType: body.targetType,
      targetSessionDateId: body.targetSessionDateId ?? null, targetClassId: body.targetClassId ?? null,
      targetDate: body.targetDate ?? null, note: body.note ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const map: Record<string, string> = {
      NOT_OWNER: "본인 자녀의 결석만 신청할 수 있습니다.",
      MAKEUP_ALREADY_EXISTS: "이미 보강이 신청/배정된 결석입니다.",
      TARGET_FULL: "선택한 날짜는 정원이 찼습니다.",
      TARGET_ALREADY_ENROLLED: "그 날은 원래 수업이 있는 날입니다. 다른 날짜를 선택해 주세요.",
      TARGET_NOT_IN_OFFERING: "같은 특강의 날짜만 선택할 수 있습니다.",
      TARGET_SESSION_DATE_REQUIRED: "보강 날짜를 선택하세요.",
      PARENT_PHONE_UNKNOWN: "계정에 등록된 전화번호가 없습니다.",
    };
    const known = map[code];
    if (!known) console.error("[api/mypage/seasonal-makeup] POST failed:", error);
    return NextResponse.json({ error: known || "신청에 실패했습니다." }, { status: known ? 409 : 500 });
  }
}
