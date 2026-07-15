BEGIN;
ALTER TABLE "NotificationDelivery"
  ADD COLUMN IF NOT EXISTS "payloadJSON" JSONB,
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lockToken" TEXT;

-- 구형 즉시 발송 행에는 재전송에 필요한 본문이 없으므로 안전하게 종료합니다.
UPDATE "NotificationDelivery"
SET status = 'SKIPPED', "errorCode" = 'LEGACY_OUTBOX_PAYLOAD_MISSING', "updatedAt" = NOW()
WHERE channel = 'PUSH' AND status = 'PENDING' AND "payloadJSON" IS NULL;
CREATE INDEX IF NOT EXISTS "NotificationDelivery_push_outbox_claim_idx"
  ON "NotificationDelivery" (status, "nextAttemptAt", "createdAt")
  WHERE channel = 'PUSH' AND status = 'PENDING';
COMMIT;
