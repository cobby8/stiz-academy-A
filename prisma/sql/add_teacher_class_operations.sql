-- 선생님 수업 운영에 필요한 출결 상세, 공지 작성자, 알림 중복 방지 장부를 추가합니다.

ALTER TABLE "Attendance"
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS "checkedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "arrivedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "checkedByUserId" TEXT;

ALTER TABLE "Notice"
  ADD COLUMN IF NOT EXISTS "authorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "eventType" TEXT NOT NULL,
  "sessionId" TEXT,
  "attendanceId" TEXT,
  "noticeId" TEXT,
  "studentId" TEXT,
  "recipientUserId" TEXT,
  "recipientPhone" TEXT,
  channel TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMPTZ,
  "failedAt" TIMESTAMPTZ,
  "errorCode" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "NotificationDelivery_status_createdAt_idx"
  ON "NotificationDelivery" (status, "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationDelivery_sessionId_eventType_idx"
  ON "NotificationDelivery" ("sessionId", "eventType");

CREATE INDEX IF NOT EXISTS "NotificationDelivery_recipientUserId_createdAt_idx"
  ON "NotificationDelivery" ("recipientUserId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'NotificationDelivery_status_check'
      AND conrelid = '"NotificationDelivery"'::regclass
  ) THEN
    ALTER TABLE "NotificationDelivery"
      ADD CONSTRAINT "NotificationDelivery_status_check"
      CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'NotificationDelivery_channel_check'
      AND conrelid = '"NotificationDelivery"'::regclass
  ) THEN
    ALTER TABLE "NotificationDelivery"
      ADD CONSTRAINT "NotificationDelivery_channel_check"
      CHECK (channel IN ('IN_APP', 'PUSH', 'SMS'));
  END IF;
END
$$;
