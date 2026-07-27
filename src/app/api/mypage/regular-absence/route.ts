import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedParent } from "@/lib/auth-guard";
import {
  getUpcomingRegularClassDates,
  reportRegularAbsence,
  cancelRegularAbsence,
} from "@/lib/regular/parent-regular-absence";

export const dynamic = "force-dynamic";

// 다가오는 정규 수업일 + 결석 신고 상태 조회
export async function GET() {
  let parent;
  try {
    parent = await requireVerifiedParent();
  } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const children = await getUpcomingRegularClassDates(parent.appUserId);
    return NextResponse.json({ children }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/mypage/regular-absence] GET failed:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

// 결석 신고(report) / 신고 취소(cancel) — body.action 으로 분기
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
    let result;
    if (body?.action === "cancel") {
      result = await cancelRegularAbsence(parent.appUserId, {
        id: body.id,
        studentId: body.studentId,
        classId: body.classId,
        date: body.date,
      });
    } else {
      result = await reportRegularAbsence(parent.appUserId, {
        studentId: body.studentId,
        classId: body.classId,
        date: body.date,
        reason: body.reason,
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    // 에러코드 → 학부모용 한국어 메시지
    const map: Record<string, string> = {
      NOT_OWNER: "본인 자녀의 수업만 신고할 수 있습니다.",
      INVALID_REASON: "결석 사유를 선택해 주세요.",
      INVALID_DATE: "날짜 형식이 올바르지 않습니다.",
      STUDENT_OR_CLASS_MISSING: "자녀와 반을 선택해 주세요.",
      NOT_REPORTABLE_DATE: "미래의 수업 날짜만 신고할 수 있습니다.",
      ABSENCE_NOT_FOUND: "결석 신고를 찾을 수 없습니다.",
      ABSENCE_NOT_CANCELABLE: "이미 학원에서 확정된 신고라 취소할 수 없습니다.",
    };
    const known = map[code];
    if (!known) console.error("[api/mypage/regular-absence] POST failed:", error);
    return NextResponse.json({ error: known || "처리에 실패했습니다." }, { status: known ? 409 : 500 });
  }
}
