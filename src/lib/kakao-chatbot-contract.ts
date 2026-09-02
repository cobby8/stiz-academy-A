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
