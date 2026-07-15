BEGIN;

CREATE TABLE IF NOT EXISTS "MediaRevocationJob" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "studentId" TEXT NOT NULL REFERENCES "Student"(id) ON DELETE CASCADE,
  "consentId" TEXT NOT NULL REFERENCES "StudentMediaConsent"(id) ON DELETE CASCADE,
  "draftId" TEXT NOT NULL REFERENCES "SocialPostDraft"(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('GALLERY', 'INSTAGRAM')),
  "resourceId" TEXT,
  "resourceUrl" TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'REMOVED', 'FAILED', 'MANUAL_REQUIRED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "lockedAt" TIMESTAMPTZ(6),
  "lastError" TEXT,
  "removedAt" TIMESTAMPTZ(6),
  "confirmationEvidenceJSON" TEXT,
  "confirmedByUserId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  UNIQUE ("consentId", "draftId", channel)
);

ALTER TABLE "MediaRevocationJob" ADD COLUMN IF NOT EXISTS "resourceUrl" TEXT;
ALTER TABLE "MediaRevocationJob" ADD COLUMN IF NOT EXISTS "confirmationEvidenceJSON" TEXT;
ALTER TABLE "MediaRevocationJob" ADD COLUMN IF NOT EXISTS "confirmedByUserId" TEXT;
ALTER TABLE "MediaRevocationJob" DROP CONSTRAINT IF EXISTS "MediaRevocationJob_draftId_channel_key";
CREATE UNIQUE INDEX IF NOT EXISTS "MediaRevocationJob_consentId_draftId_channel_key"
  ON "MediaRevocationJob" ("consentId", "draftId", channel);

CREATE TABLE IF NOT EXISTS "SocialPublishAttempt" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "draftId" TEXT NOT NULL REFERENCES "SocialPostDraft"(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('GALLERY', 'INSTAGRAM')),
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "subjectSnapshotJSON" TEXT NOT NULL,
  "subjectSnapshotHash" TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PUBLISHING' CHECK (state IN ('PUBLISHING','AMBIGUOUS','PUBLISHED','FAILED')),
  "providerMediaId" TEXT, "providerPermalink" TEXT, "providerResultJSON" TEXT, "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
ALTER TABLE "SocialPostDraft" ADD COLUMN IF NOT EXISTS "publicationSubjectsJSON" TEXT;
ALTER TABLE "SocialPostDraft" ADD COLUMN IF NOT EXISTS "publicationSubjectHash" TEXT;
ALTER TABLE "SocialPostDraft" ADD COLUMN IF NOT EXISTS "publishReservationId" TEXT;
CREATE INDEX IF NOT EXISTS "SocialPublishAttempt_draft_createdAt_idx" ON "SocialPublishAttempt" ("draftId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "SocialPublishAttempt_state_updatedAt_idx" ON "SocialPublishAttempt" (state, "updatedAt");

CREATE TABLE IF NOT EXISTS "StorageDeletionJob" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  bucket TEXT NOT NULL, path TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','DELETED','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), "lockedAt" TIMESTAMPTZ(6), "lastError" TEXT,
  "deletedAt" TIMESTAMPTZ(6), "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  UNIQUE (bucket, path)
);
CREATE INDEX IF NOT EXISTS "StorageDeletionJob_status_nextAttemptAt_idx" ON "StorageDeletionJob" (status, "nextAttemptAt");
ALTER TABLE "StorageDeletionJob" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMPTZ(6);

CREATE OR REPLACE FUNCTION stiz_try_jsonb(value TEXT) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN value::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "MediaRevocationJob_status_nextAttemptAt_idx"
  ON "MediaRevocationJob" (status, "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "MediaRevocationJob_student_createdAt_idx"
  ON "MediaRevocationJob" ("studentId", "createdAt" DESC);

ALTER TABLE "MediaRevocationJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialPublishAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StorageDeletionJob" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "MediaRevocationJob" FROM anon, authenticated;
REVOKE ALL ON TABLE "SocialPublishAttempt" FROM anon, authenticated;
REVOKE ALL ON TABLE "StorageDeletionJob" FROM anon, authenticated;
REVOKE ALL ON FUNCTION stiz_try_jsonb(TEXT) FROM PUBLIC;

COMMIT;
