import { createHash, createHmac } from "node:crypto";

function privacySecret() {
  const value =
    process.env.NOTIFICATION_PRIVACY_SECRET?.trim() ||
    process.env.PARENT_ACCOUNT_CLAIM_SECRET?.trim() ||
    process.env.INVITE_OTP_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NOTIFICATION_PRIVACY_SECRET_MISSING");
  }
  return "development-only-notification-privacy-secret";
}

export function normalizeMessagePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

/** 전화번호 원문 대신 검색·중복 제거에 사용할 비가역 HMAC을 만듭니다. */
export function hashMessageRecipientPhone(phone: string) {
  return createHmac("sha256", privacySecret())
    .update(normalizeMessagePhone(phone))
    .digest("hex");
}

/** 본문 원문을 장부에 남기지 않고 어떤 문안이 발송됐는지만 확인합니다. */
export function hashMessageBody(body: string) {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function messagePhoneLast4(phone: string) {
  return normalizeMessagePhone(phone).slice(-4) || null;
}

const AUDIT_SAFE_KEYS = new Set([
  "trigger",
  "name",
  "target",
  "audienceScope",
  "isActive",
  "requestedChannel",
  "fallbackEnabled",
  "fallbackChannel",
  "provider",
  "priority",
  "templateId",
  "description",
]);

/**
 * 감사로그에는 허용된 운영 필드만 남기며 본문은 원문 대신 해시로 치환합니다.
 * 공급자 키·전화번호 같은 설정 객체의 나머지 값은 저장하지 않습니다.
 */
export function sanitizeMessageSettingAuditSnapshot(
  input: Record<string, unknown> | null | undefined,
) {
  if (!input) return null;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (AUDIT_SAFE_KEYS.has(key)) safe[key] = value;
  }
  if (typeof input.body === "string") safe.bodyHash = hashMessageBody(input.body);
  return safe;
}

/** 같은 사건·수신자·템플릿 조합의 중복 발송을 막는 안정적인 키입니다. */
export function buildMessageDedupeKey(input: {
  source: "AUTO" | "MANUAL" | "SECURITY";
  eventKey: string;
  recipientPhoneHash: string;
  templateVersion?: string | null;
}) {
  return [
    "message",
    input.source.toLowerCase(),
    input.eventKey.trim(),
    input.recipientPhoneHash,
    input.templateVersion?.trim() || "unversioned",
  ].join(":");
}
