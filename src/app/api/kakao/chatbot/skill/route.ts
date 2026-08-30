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
    const identity = await resolveIdentity(botId, userKey);
    if (!identity || identity.status !== "ACTIVE" || !identity.parentUserId) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
      const link = await issueLink(botId, userKey, origin);
      return NextResponse.json(kakaoText(
        "처음 한 번만 학부모 인증을 해주세요. 인증이 끝나면 다음부터는 자녀를 자동으로 알아볼게요.",
        [],
        { label: "학부모 인증하기", url: link.url },
      ));
    }
    return NextResponse.json(await handleLinkedMessage(identity, utterance));
  } catch (error) {
    console.error("[kakao chatbot skill] failed:", error instanceof Error ? error.message : "UNKNOWN");
    return NextResponse.json(kakaoText("지금은 접수 연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요."));
  }
}
