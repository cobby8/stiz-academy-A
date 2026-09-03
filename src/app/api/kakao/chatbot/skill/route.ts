import { NextRequest, NextResponse } from "next/server";
import {
  getKakaoUserKey,
  handleLinkedMessage,
  issueLink,
  kakaoText,
  resolveIdentity,
  verifySkillSecret,
  type KakaoSkillPayload,
} from "@/lib/kakao-parent-chatbot";
import { getKakaoRequestId } from "@/lib/kakao-chatbot-contract";
import { kakaoGuestEntry } from "@/lib/kakao-guest-entry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!verifySkillSecret(request.headers.get("x-stiz-kakao-skill-secret"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 64 * 1024) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }
  let payload: KakaoSkillPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(kakaoText("요청을 읽지 못했어요. 다시 말씀해 주세요."), { status: 400 });
  }
  const botId = payload.bot?.id?.trim();
  const userKey = getKakaoUserKey(payload);
  const utterance = payload.userRequest?.utterance?.trim() || "메뉴";
  if (!botId || !userKey) return NextResponse.json(kakaoText("카카오 사용자 정보를 확인하지 못했어요."));

  try {
    // 시작한 쓰기를 시간 제한 경주로 버리지 않는다. 응답 실패 뒤 DB만 반영되는
    // 불일치는 빠른 실패보다 위험하므로, 각 쿼리를 짧게 유지하고 결과를 기다린다.
    const identity = await resolveIdentity(botId, userKey);
    if (!identity || identity.status !== "ACTIVE" || !identity.parentUserId) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
      const guestResponse = kakaoGuestEntry(utterance, origin);
      if (guestResponse) return NextResponse.json(guestResponse);
      // 명시적으로 기존 수강생 인증을 선택할 때만 일회용 인증 레코드를 만든다.
      const link = await issueLink(botId, userKey, origin);
      return NextResponse.json(kakaoText(
        "처음 한 번만 학부모 인증을 해주세요. 인증이 끝나면 다음부터는 자녀를 자동으로 알아볼게요.",
        [],
        { label: "학부모 인증하기", url: link.url },
      ));
    }
    const requestId = getKakaoRequestId(payload, request.headers.get("x-kakao-request-id"));
    return NextResponse.json(await handleLinkedMessage(identity, utterance, requestId));
  } catch (error) {
    console.error("[kakao chatbot skill] failed:", error instanceof Error ? error.message : "UNKNOWN");
    return NextResponse.json(kakaoText("지금은 접수 연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요."));
  }
}
