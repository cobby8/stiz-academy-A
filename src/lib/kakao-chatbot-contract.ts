export type KakaoSkillPayload = {
  bot?: { id?: string; name?: string };
  userRequest?: {
    requestId?: string;
    utterance?: string;
    user?: { id?: string; properties?: Record<string, unknown> };
  };
};

export function getKakaoRequestId(payload: KakaoSkillPayload, headerRequestId?: string | null): string | null {
  const value = headerRequestId ?? payload.userRequest?.requestId;
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 200
    ? value.trim()
    : null;
}

export type ParentRequestKind =
  | "REGULAR_ABSENCE" | "SEASONAL_ABSENCE" | "MAKEUP" | "EARLY_LEAVE"
  | "SHUTTLE_SKIP" | "SHUTTLE_LOCATION" | "SHUTTLE_START_STOP" | "SHUTTLE_CHANGE" | "SHUTTLE_FEE"
  | "PAYMENT_CONFIRM" | "BILLING_CORRECTION" | "RECEIPT" | "REFUND"
  | "CLASS_CHANGE" | "CLASS_ADD" | "PAUSE" | "RESUME" | "WITHDRAW"
  | "CONTACT_CHANGE" | "CONSULTATION" | "HUMAN" | "UNKNOWN";

export function getKakaoUserKey(payload: KakaoSkillPayload): string | null {
  const user = payload.userRequest?.user;
  const propertyKey = user?.properties?.plusfriendUserKey ?? user?.properties?.botUserKey;
  const value = typeof propertyKey === "string" ? propertyKey : user?.id;
  return typeof value === "string" && value.trim().length <= 200 ? value.trim() : null;
}

export function classifyParentUtterance(source: string): ParentRequestKind {
  const text = source.replace(/\s+/g, " ").trim();
  if (/상담원|원장님|사람.*상담/.test(text)) return "HUMAN";
  if (/연락처|전화번호/.test(text) && /변경|바꿔/.test(text)) return "CONTACT_CHANGE";
  if (/영수증|현금영수증|지출증빙/.test(text)) return "RECEIPT";
  if (/환불|결제\s*취소/.test(text)) return "REFUND";
  if (/입금|송금/.test(text)) return "PAYMENT_CONFIRM";
  if (/청구|수강료|금액/.test(text)) return "BILLING_CORRECTION";
  if (/퇴원|그만\s*다/.test(text)) return "WITHDRAW";
  if (/휴원|잠시\s*쉬/.test(text)) return "PAUSE";
  if (/복귀|다시\s*다니/.test(text)) return "RESUME";
  if (/수업.*추가|반.*추가/.test(text)) return "CLASS_ADD";
  if (/반\s*변경|요일.*변경|시간.*변경|옮기/.test(text)) return "CLASS_CHANGE";
  if (/셔틀|차량|차\s/.test(text)) {
    if (/안\s*타|미탑승/.test(text)) return "SHUTTLE_SKIP";
    if (/다른\s*(곳|장소)|장소.*타/.test(text)) return "SHUTTLE_LOCATION";
    if (/신청|시작|중단|이용\s*안/.test(text)) return "SHUTTLE_START_STOP";
    if (/요금|비용|면제|셔틀비/.test(text)) return "SHUTTLE_FEE";
    return "SHUTTLE_CHANGE";
  }
  if (/방학|특강/.test(text) && /결석|못\s*(가|나)/.test(text)) return "SEASONAL_ABSENCE";
  if (/보강/.test(text)) return "MAKEUP";
  if (/조퇴|일찍\s*(가|나)/.test(text)) return "EARLY_LEAVE";
  if (/결석|수업.*못\s*(가|나)|오늘.*못\s*(가|나)/.test(text)) return "REGULAR_ABSENCE";
  if (/상담|문의|궁금/.test(text)) return "CONSULTATION";
  return "UNKNOWN";
}

// ── 스킬 응답 말풍선 규격 ─────────────────────────────────────────────
// 오픈빌더는 basicCard 에 thumbnail 이 없으면 "말풍선 가이드 위반(2461)"으로 미발송 처리한다
// (2026-10-07 운영 스킬 오류 내역에서 확인). 그래서 버튼이 있는 안내는 thumbnail 이 필요 없는
// textCard 로만 보낸다. 규격: title·description 중 하나 이상, buttons 최대 3개, 버튼 라벨 14자,
// description 400자. 바로가기(quickReplies)는 최대 10개, 라벨 14자.
export const KAKAO_TEXT_CARD_DESCRIPTION_MAX = 400;
export const KAKAO_BUTTON_LABEL_MAX = 14;
export const KAKAO_MAX_CARD_BUTTONS = 3;
export const KAKAO_MAX_QUICK_REPLIES = 10;

export type KakaoCardButton =
  | { action: "webLink"; label: string; webLinkUrl: string }
  | { action: "message"; label: string; messageText: string };

/** 글자 수 제한을 넘으면 말줄임표로 자른다(넘긴 채 보내면 말풍선 자체가 거절된다). */
function clip(value: string, max: number): string {
  const chars = [...value];
  return chars.length <= max ? value : `${chars.slice(0, max - 1).join("")}…`;
}

/**
 * 카카오 스킬 응답(version 2.0)을 만든다.
 * - 버튼이 없으면 simpleText(1000자)
 * - 버튼이 있으면 textCard(thumbnail 불필요). basicCard 는 쓰지 않는다.
 */
export function buildKakaoSkillResponse(input: {
  text: string;
  title?: string;
  buttons?: KakaoCardButton[];
  quickReplies?: string[];
}) {
  const buttons = (input.buttons ?? [])
    .slice(0, KAKAO_MAX_CARD_BUTTONS)
    .map((button) => ({ ...button, label: clip(button.label, KAKAO_BUTTON_LABEL_MAX) }));
  const outputs = buttons.length > 0
    ? [{
      textCard: {
        ...(input.title ? { title: clip(input.title, 50) } : {}),
        description: clip(input.text, KAKAO_TEXT_CARD_DESCRIPTION_MAX),
        buttons,
      },
    }]
    : [{ simpleText: { text: clip(input.text, 1000) } }];
  return {
    version: "2.0",
    template: {
      outputs,
      // messageText 는 자르지 않는다 — 버튼을 누르면 이 문장이 그대로 발화로 돌아와 매칭된다.
      quickReplies: (input.quickReplies ?? [])
        .slice(0, KAKAO_MAX_QUICK_REPLIES)
        .map((label) => ({ action: "message", label: clip(label, KAKAO_BUTTON_LABEL_MAX), messageText: label })),
    },
  };
}
