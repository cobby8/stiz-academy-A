import { createHash, createHmac, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type MessageLedgerSource = "AUTO" | "MANUAL" | "SECURITY";

function privacySecret() {
  const value = process.env.MESSAGE_PRIVACY_HMAC_SECRET?.trim();
  if (value && Buffer.byteLength(value, "utf8") >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MESSAGE_PRIVACY_HMAC_SECRET_INVALID");
  }
  const developmentValue =
    value ||
    process.env.NOTIFICATION_PRIVACY_SECRET?.trim() ||
    process.env.PARENT_ACCOUNT_CLAIM_SECRET?.trim() ||
    process.env.INVITE_OTP_SECRET?.trim() ||
    "development-only-notification-privacy-secret";
  return Buffer.byteLength(developmentValue, "utf8") >= 32
    ? developmentValue
    : "development-only-notification-privacy-secret";
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

export async function reserveMessageDeliveryBatch(input: {
  source: MessageLedgerSource;
  stableEventKey: string;
  audienceScope: "INTERNAL" | "EXTERNAL" | "SECURITY";
  trigger?: string | null;
  purpose: string;
  actorUserId?: string | null;
  actorName?: string | null;
  reason?: string | null;
  body: string;
  requestedChannel?: string | null;
  templateId?: string | null;
  templateVersion?: string | null;
}) {
  const insertSql = `INSERT INTO "MessageDeliveryBatch" (
       id, source, "audienceScope", trigger, purpose, "actorUserId", "actorName", reason, "bodyHash",
       "stableEventKey", "requestedChannel", "templateId", "templateVersion",
       status, "totalCount", "successCount", "failureCount", "createdAt", "updatedAt"
     ) VALUES (
       gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
       'PROCESSING', 0, 0, 0, NOW(), NOW()
     ) ON CONFLICT DO NOTHING RETURNING id`;
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    insertSql,
    input.source,
    input.audienceScope,
    input.trigger ?? null,
    input.purpose,
    input.actorUserId ?? null,
    input.actorName ?? null,
    input.reason ?? null,
    hashMessageBody(input.body),
    input.stableEventKey,
    input.requestedChannel ?? "SMS",
    input.templateId ?? null,
    input.templateVersion ?? null,
  );
  if (rows[0]?.id) return rows[0].id;
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "MessageDeliveryBatch"
      WHERE source = $1 AND "stableEventKey" = $2
      ORDER BY "createdAt" DESC LIMIT 1`,
    input.source,
    input.stableEventKey,
  );
  return existing[0]?.id ?? null;
}

export async function reserveMessageDelivery(input: {
  batchId: string;
  source: MessageLedgerSource;
  stableEventKey: string;
  eventType: string;
  trigger?: string | null;
  audienceScope: "INTERNAL" | "EXTERNAL" | "SECURITY";
  recipientUserId?: string | null;
  recipientPhone: string;
  body: string;
  requestedChannel?: string | null;
  templateId?: string | null;
  templateVersion?: string | null;
}) {
  const recipientPhoneHash = hashMessageRecipientPhone(input.recipientPhone);
  const dedupeKey = buildMessageDedupeKey({
    source: input.source,
    eventKey: input.stableEventKey,
    recipientPhoneHash,
    templateVersion: input.templateVersion,
  });
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "NotificationDelivery" (
         id, "batchId", source, "stableEventKey", "eventType", trigger, "audienceScope",
         "recipientUserId", "recipientPhone", "recipientPhoneHash", "recipientPhoneLast4",
         "bodyHash", "templateId", "templateVersion", channel, "requestedChannel",
         "dedupeKey", status, "attemptCount", "createdAt", "updatedAt"
       ) VALUES (
         gen_random_uuid()::text, $1, $2, $3, $4, $5, $6,
         $7, NULL, $8, $9, $10, $11, $12, 'SMS', $13,
         $14, 'PENDING', 0, NOW(), NOW()
       )
       ON CONFLICT ("dedupeKey") DO NOTHING
       RETURNING id`,
      input.batchId,
      input.source,
      input.stableEventKey,
      input.eventType,
      input.trigger ?? null,
      input.audienceScope,
      input.recipientUserId ?? null,
      recipientPhoneHash,
      messagePhoneLast4(input.recipientPhone),
      hashMessageBody(input.body),
      input.templateId ?? null,
      input.templateVersion ?? null,
      input.requestedChannel ?? "SMS",
      dedupeKey,
    );
    if (rows[0]?.id) {
      await tx.$executeRawUnsafe(
        `UPDATE "MessageDeliveryBatch"
            SET "totalCount" = "totalCount" + 1, "updatedAt" = NOW()
          WHERE id = $1`,
        input.batchId,
      );
      return { deliveryId: rows[0].id, dedupeKey, existingStatus: null };
    }
    const existing = await tx.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT status FROM "NotificationDelivery" WHERE "dedupeKey" = $1 LIMIT 1`,
      dedupeKey,
    );
    return { deliveryId: null, dedupeKey, existingStatus: existing[0]?.status ?? null };
  });
}

export async function claimMessageDelivery(deliveryId: string) {
  const lockToken = randomUUID();
  const rows = await prisma.$queryRawUnsafe<Array<{ lockToken: string }>>(
    `UPDATE "NotificationDelivery"
        SET status = 'SENDING', "lockedAt" = NOW(), "lockToken" = $2,
            "attemptCount" = "attemptCount" + 1, "updatedAt" = NOW()
      WHERE id = $1 AND status = 'PENDING'
      RETURNING "lockToken"`,
    deliveryId,
    lockToken,
  );
  return {
    claimed: rows[0]?.lockToken === lockToken,
    lockToken: rows[0]?.lockToken ?? null,
  };
}

export async function finalizeMessageDelivery(input: {
  deliveryId: string;
  ok: boolean;
  provider?: string | null;
  requestedChannel?: string | null;
  actualChannel?: string | null;
  providerGroupId?: string | null;
  providerMessageId?: string | null;
  providerStatus?: string | null;
  fallbackUsed?: boolean;
  fallbackChannel?: string | null;
  unitCost?: number | null;
  errorCode?: string | null;
}) {
  await prisma.$executeRawUnsafe(
    `UPDATE "NotificationDelivery"
        SET status = $2,
            "sentAt" = CASE WHEN $2 = 'SENT' THEN NOW() ELSE NULL END,
            "failedAt" = CASE WHEN $2 = 'FAILED' THEN NOW() ELSE NULL END,
            provider = $3, "requestedChannel" = $4, channel = COALESCE($5, channel),
            "messageType" = $5, "providerGroupId" = $6, "providerMessageId" = $7,
            "providerStatus" = $8, "fallbackUsed" = $9, "fallbackChannel" = $10,
            "unitCost" = $11, "errorCode" = $12, "lockedAt" = NULL, "lockToken" = NULL,
            "nextAttemptAt" = NULL, "updatedAt" = NOW()
      WHERE id = $1`,
    input.deliveryId,
    input.ok ? "SENT" : "FAILED",
    input.provider ?? null,
    input.requestedChannel ?? null,
    input.actualChannel ?? null,
    input.providerGroupId ?? null,
    input.providerMessageId ?? null,
    input.providerStatus ?? (input.ok ? "ACCEPTED" : "FAILED"),
    input.fallbackUsed ?? false,
    input.fallbackChannel ?? null,
    input.unitCost ?? null,
    input.errorCode ?? null,
  );
}

export async function finalizeMessageDeliveryBatch(batchId: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE "MessageDeliveryBatch" b
        SET "successCount" = counts.success_count,
            "failureCount" = counts.failure_count,
            "totalCount" = counts.total_count,
            status = CASE
              WHEN counts.pending_count > 0 THEN 'PROCESSING'
              WHEN counts.success_count = counts.total_count THEN 'SENT'
              WHEN counts.success_count > 0 THEN 'PARTIAL'
              ELSE 'FAILED'
            END,
            "completedAt" = CASE WHEN counts.pending_count = 0 THEN NOW() ELSE NULL END,
            "updatedAt" = NOW()
       FROM (
         SELECT "batchId", COUNT(*)::int AS total_count,
                COUNT(*) FILTER (WHERE status = 'SENT')::int AS success_count,
                COUNT(*) FILTER (WHERE status IN ('FAILED', 'SKIPPED'))::int AS failure_count,
                COUNT(*) FILTER (WHERE status IN ('PENDING', 'SENDING'))::int AS pending_count
           FROM "NotificationDelivery" WHERE "batchId" = $1 GROUP BY "batchId"
       ) counts
      WHERE b.id = counts."batchId"`,
    batchId,
  );
}
