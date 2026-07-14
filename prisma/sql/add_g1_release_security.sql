BEGIN;

-- 기존 중복을 조용히 합치면 결제 감사 기록이 훼손될 수 있으므로 명확하게 중단합니다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "PaymentWebhookEvent"
     WHERE "eventId" IS NOT NULL
     GROUP BY provider, "eventId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'G1 preflight failed: duplicate PaymentWebhookEvent(provider, eventId) rows exist';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "StudentMediaConsent" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "studentId" TEXT NOT NULL REFERENCES "Student"(id) ON DELETE CASCADE,
  "guardianUserId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "internalAllowed" BOOLEAN NOT NULL DEFAULT false,
  "galleryAllowed" BOOLEAN NOT NULL DEFAULT false,
  "instagramAllowed" BOOLEAN NOT NULL DEFAULT false,
  "policyVersion" TEXT NOT NULL,
  "evidenceJSON" TEXT,
  "recordedByUserId" TEXT,
  "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "revokedAt" TIMESTAMPTZ(6),
  CONSTRAINT "StudentMediaConsent_policyVersion_check" CHECK (length(btrim("policyVersion")) > 0),
  CONSTRAINT "StudentMediaConsent_scope_check" CHECK (
    NOT "instagramAllowed" OR ("galleryAllowed" AND "internalAllowed")
  ),
  CONSTRAINT "StudentMediaConsent_gallery_scope_check" CHECK (
    NOT "galleryAllowed" OR "internalAllowed"
  )
);

CREATE INDEX IF NOT EXISTS "StudentMediaConsent_student_recordedAt_idx"
  ON "StudentMediaConsent" ("studentId", "recordedAt" DESC);
CREATE INDEX IF NOT EXISTS "StudentMediaConsent_revokedAt_idx"
  ON "StudentMediaConsent" ("revokedAt");

ALTER TABLE "SocialPostDraft"
  ADD COLUMN IF NOT EXISTS "subjectStudentIdsJSON" TEXT NOT NULL DEFAULT '[]';

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentWebhookEvent_provider_eventId_key"
  ON "PaymentWebhookEvent" (provider, "eventId");

ALTER TABLE "StudentMediaConsent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "StudentMediaConsent" FROM anon, authenticated;

-- 서버 전용 알림·결제·미디어 장부는 Data API에서 직접 읽거나 변경할 수 없게 한다.
ALTER TABLE "NotificationDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentWebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialPostDraft" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "NotificationDelivery" FROM anon, authenticated;
REVOKE ALL ON TABLE "PushSubscription" FROM anon, authenticated;
REVOKE ALL ON TABLE "Payment" FROM anon, authenticated;
REVOKE ALL ON TABLE "PaymentInvoice" FROM anon, authenticated;
REVOKE ALL ON TABLE "PaymentTransaction" FROM anon, authenticated;
REVOKE ALL ON TABLE "PaymentWebhookEvent" FROM anon, authenticated;
REVOKE ALL ON TABLE "PaymentAuditLog" FROM anon, authenticated;
REVOKE ALL ON TABLE "SocialPostDraft" FROM anon, authenticated;

ALTER TABLE "NotificationDelivery"
  DROP CONSTRAINT IF EXISTS "NotificationDelivery_status_check";
ALTER TABLE "NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_status_check"
  CHECK (status IN ('PENDING', 'SENT', 'PARTIAL', 'FAILED', 'SKIPPED'));

COMMIT;
