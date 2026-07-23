-- 문자 발송 묶음 장부: 기존 발송 행을 건드리지 않는 추가형 마이그레이션입니다.
CREATE TABLE public."MessageDeliveryBatch" (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  source text NOT NULL,
  "audienceScope" text,
  trigger text,
  "actorUserId" text,
  "actorName" text,
  purpose text NOT NULL,
  reason text,
  "templateId" text,
  "templateVersion" text,
  "bodyHash" text,
  "stableEventKey" text,
  "requestedChannel" text,
  status text NOT NULL DEFAULT 'PENDING',
  "totalCount" integer NOT NULL DEFAULT 0,
  "successCount" integer NOT NULL DEFAULT 0,
  "failureCount" integer NOT NULL DEFAULT 0,
  "metadataJSON" jsonb,
  "completedAt" timestamptz(6),
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageDeliveryBatch_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."MessageSettingAuditLog" (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  "settingType" text NOT NULL,
  "settingId" text,
  action text NOT NULL,
  "actorUserId" text,
  "actorName" text,
  reason text,
  "beforeJSON" jsonb,
  "afterJSON" jsonb,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageSettingAuditLog_pkey" PRIMARY KEY (id)
);

ALTER TABLE public."NotificationDelivery"
  ADD COLUMN IF NOT EXISTS "batchId" text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS "actorUserId" text,
  ADD COLUMN IF NOT EXISTS "actorName" text,
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS "templateId" text,
  ADD COLUMN IF NOT EXISTS "templateVersion" text,
  ADD COLUMN IF NOT EXISTS "bodyHash" text,
  ADD COLUMN IF NOT EXISTS "recipientPhoneHash" text,
  ADD COLUMN IF NOT EXISTS "recipientPhoneLast4" text,
  ADD COLUMN IF NOT EXISTS "stableEventKey" text;

ALTER TABLE public."NotificationDelivery"
  DROP CONSTRAINT IF EXISTS "NotificationDelivery_status_check";
ALTER TABLE public."NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_status_check"
  CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'PARTIAL', 'FAILED', 'SKIPPED')) NOT VALID;
ALTER TABLE public."NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_source_check"
  CHECK (source IS NULL OR source IN ('AUTO', 'MANUAL', 'SECURITY')) NOT VALID;
ALTER TABLE public."NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_bodyHash_check"
  CHECK ("bodyHash" IS NULL OR "bodyHash" ~ '^[0-9a-f]{64}$') NOT VALID;
ALTER TABLE public."NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_recipientPhoneHash_check"
  CHECK ("recipientPhoneHash" IS NULL OR "recipientPhoneHash" ~ '^[0-9a-f]{64}$') NOT VALID;
ALTER TABLE public."NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_recipientPhoneLast4_check"
  CHECK ("recipientPhoneLast4" IS NULL OR "recipientPhoneLast4" ~ '^[0-9]{4}$') NOT VALID;

ALTER TABLE public."NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES public."MessageDeliveryBatch"(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MessageDeliveryBatch_source_status_createdAt_idx"
  ON public."MessageDeliveryBatch"(source, status, "createdAt");
CREATE INDEX "MessageDeliveryBatch_actorUserId_createdAt_idx"
  ON public."MessageDeliveryBatch"("actorUserId", "createdAt");
CREATE INDEX "MessageDeliveryBatch_trigger_createdAt_idx"
  ON public."MessageDeliveryBatch"(trigger, "createdAt");
CREATE INDEX "MessageDeliveryBatch_stableEventKey_createdAt_idx"
  ON public."MessageDeliveryBatch"("stableEventKey", "createdAt");
CREATE INDEX "MessageSettingAuditLog_settingType_settingId_createdAt_idx"
  ON public."MessageSettingAuditLog"("settingType", "settingId", "createdAt");
CREATE INDEX "MessageSettingAuditLog_actorUserId_createdAt_idx"
  ON public."MessageSettingAuditLog"("actorUserId", "createdAt");
CREATE INDEX "MessageSettingAuditLog_createdAt_idx"
  ON public."MessageSettingAuditLog"("createdAt");
CREATE INDEX "NotificationDelivery_batchId_status_createdAt_idx"
  ON public."NotificationDelivery"("batchId", status, "createdAt");
CREATE INDEX "NotificationDelivery_source_status_createdAt_idx"
  ON public."NotificationDelivery"(source, status, "createdAt");
CREATE INDEX "NotificationDelivery_recipientPhoneHash_createdAt_idx"
  ON public."NotificationDelivery"("recipientPhoneHash", "createdAt");
CREATE INDEX "NotificationDelivery_recipientPhoneLast4_createdAt_idx"
  ON public."NotificationDelivery"("recipientPhoneLast4", "createdAt");
CREATE INDEX "NotificationDelivery_stableEventKey_createdAt_idx"
  ON public."NotificationDelivery"("stableEventKey", "createdAt");
CREATE UNIQUE INDEX "MessageDeliveryBatch_source_stableEventKey_key"
  ON public."MessageDeliveryBatch"(source, "stableEventKey")
  WHERE source IN ('AUTO', 'SECURITY') AND "stableEventKey" IS NOT NULL;

ALTER TABLE public."MessageDeliveryBatch"
  ADD CONSTRAINT "MessageDeliveryBatch_source_check"
    CHECK (source IN ('AUTO', 'MANUAL', 'SECURITY')),
  ADD CONSTRAINT "MessageDeliveryBatch_status_check"
    CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'PARTIAL', 'FAILED', 'CANCELLED')),
  ADD CONSTRAINT "MessageDeliveryBatch_counts_check"
    CHECK ("totalCount" >= 0 AND "successCount" >= 0 AND "failureCount" >= 0
      AND "successCount" + "failureCount" <= "totalCount"),
  ADD CONSTRAINT "MessageDeliveryBatch_bodyHash_check"
    CHECK ("bodyHash" IS NULL OR "bodyHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE public."MessageSettingAuditLog"
  ADD CONSTRAINT "MessageSettingAuditLog_settingType_check"
    CHECK ("settingType" IN ('AUTOMATION_RULE', 'CHANNEL', 'TEMPLATE')),
  ADD CONSTRAINT "MessageSettingAuditLog_action_check"
    CHECK (action IN ('CREATE', 'UPDATE', 'RESET', 'DELETE'));

-- 서버 전용 개인정보·감사 장부입니다. 서비스 역할만 접근합니다.
ALTER TABLE public."NotificationDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NotificationDelivery" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."MessageDeliveryBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MessageDeliveryBatch" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."MessageSettingAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MessageSettingAuditLog" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."SmsTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SmsTemplate" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."MessageAutomationRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MessageAutomationRule" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."MessageChannelSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MessageChannelSetting" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."NotificationDelivery" FROM anon, authenticated;
REVOKE ALL ON TABLE public."MessageDeliveryBatch" FROM anon, authenticated;
REVOKE ALL ON TABLE public."MessageSettingAuditLog" FROM anon, authenticated;
REVOKE ALL ON TABLE public."SmsTemplate" FROM anon, authenticated;
REVOKE ALL ON TABLE public."MessageAutomationRule" FROM anon, authenticated;
REVOKE ALL ON TABLE public."MessageChannelSetting" FROM anon, authenticated;
