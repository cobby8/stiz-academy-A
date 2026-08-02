-- 예약 발송 대기열. 문안을 값으로 얼려 두어, 발송 시점에 노선이 바뀌어도
-- 원장이 검토한 내용 그대로 나가게 한다.
CREATE TABLE IF NOT EXISTS "ScheduledMessage" (
  "id"        TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "batchKey"  TEXT NOT NULL,
  "sendAt"    TIMESTAMPTZ(6) NOT NULL,
  "recipient" TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "label"     TEXT,
  "status"    TEXT NOT NULL DEFAULT 'PENDING',
  "requestId" TEXT NOT NULL,
  "purpose"   TEXT,
  "attempts"  INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "sentAt"    TIMESTAMPTZ(6),
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ScheduledMessage_status_sendAt_idx" ON "ScheduledMessage" ("status", "sendAt");
CREATE INDEX IF NOT EXISTS "ScheduledMessage_batchKey_idx" ON "ScheduledMessage" ("batchKey");
