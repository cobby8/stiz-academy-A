BEGIN;

CREATE TABLE IF NOT EXISTS "SessionPhotoDeletionJob" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "photoId" TEXT NOT NULL UNIQUE,
  "storageBucket" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lockedAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "SessionPhotoDeletionJob_status_check"
    CHECK (status IN ('RESERVED', 'PENDING', 'PROCESSING', 'FAILED', 'DELETED'))
);

CREATE INDEX IF NOT EXISTS "SessionPhotoDeletionJob_queue_idx"
  ON "SessionPhotoDeletionJob" (status, "nextAttemptAt");

ALTER TABLE "SessionPhotoDeletionJob" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SessionPhotoDeletionJob" FROM anon, authenticated;

COMMIT;
