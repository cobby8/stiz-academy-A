BEGIN;

CREATE TABLE IF NOT EXISTS "MediaRevocationJob" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "studentId" TEXT NOT NULL,
  "consentId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
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
  "studentSnapshotJSON" TEXT NOT NULL DEFAULT '{}',
  "consentSnapshotJSON" TEXT NOT NULL DEFAULT '{}',
  "draftSnapshotJSON" TEXT NOT NULL DEFAULT '{}',
  "confirmedByUserId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  UNIQUE ("consentId", "draftId", channel)
);

ALTER TABLE "MediaRevocationJob" ADD COLUMN IF NOT EXISTS "resourceUrl" TEXT;
ALTER TABLE "MediaRevocationJob" ADD COLUMN IF NOT EXISTS "confirmationEvidenceJSON" TEXT;
ALTER TABLE "MediaRevocationJob" ADD COLUMN IF NOT EXISTS "confirmedByUserId" TEXT;
ALTER TABLE "MediaRevocationJob" ADD COLUMN IF NOT EXISTS "studentSnapshotJSON" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "MediaRevocationJob" ADD COLUMN IF NOT EXISTS "consentSnapshotJSON" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "MediaRevocationJob" ADD COLUMN IF NOT EXISTS "draftSnapshotJSON" TEXT NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION stiz_fill_media_revocation_snapshot() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."studentSnapshotJSON" IS NULL OR NEW."studentSnapshotJSON" = '{}' THEN
    NEW."studentSnapshotJSON" := COALESCE(
      (SELECT jsonb_build_object('id', s.id, 'name', s.name)::text FROM "Student" s WHERE s.id = NEW."studentId"),
      jsonb_build_object('id', NEW."studentId")::text
    );
  END IF;
  IF NEW."consentSnapshotJSON" IS NULL OR NEW."consentSnapshotJSON" = '{}' THEN
    NEW."consentSnapshotJSON" := COALESCE(
      (SELECT jsonb_build_object('id', c.id, 'policyVersion', c."policyVersion", 'recordedAt', c."recordedAt", 'revokedAt', c."revokedAt")::text
         FROM "StudentMediaConsent" c WHERE c.id = NEW."consentId"),
      jsonb_build_object('id', NEW."consentId")::text
    );
  END IF;
  IF NEW."draftSnapshotJSON" IS NULL OR NEW."draftSnapshotJSON" = '{}' THEN
    NEW."draftSnapshotJSON" := COALESCE(
      (SELECT jsonb_build_object('id', d.id, 'status', d.status, 'subjects', d."subjectStudentIdsJSON",
        'galleryPostId', d."galleryPostId", 'instagramMediaId', d."instagramMediaId", 'instagramPermalink', d."instagramPermalink")::text
         FROM "SocialPostDraft" d WHERE d.id = NEW."draftId"),
      jsonb_build_object('id', NEW."draftId")::text
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS "MediaRevocationJob_snapshot_trigger" ON "MediaRevocationJob";
CREATE TRIGGER "MediaRevocationJob_snapshot_trigger"
BEFORE INSERT ON "MediaRevocationJob" FOR EACH ROW EXECUTE FUNCTION stiz_fill_media_revocation_snapshot();
REVOKE ALL ON FUNCTION stiz_fill_media_revocation_snapshot() FROM PUBLIC;

-- Queue/audit evidence must survive deletion of the source student, consent, or draft.
UPDATE "MediaRevocationJob" j SET
  "studentSnapshotJSON" = COALESCE((SELECT jsonb_build_object('id', s.id, 'name', s.name)::text FROM "Student" s WHERE s.id = j."studentId"), jsonb_build_object('id', j."studentId")::text),
  "consentSnapshotJSON" = COALESCE((SELECT jsonb_build_object('id', c.id, 'policyVersion', c."policyVersion", 'recordedAt', c."recordedAt", 'revokedAt', c."revokedAt")::text FROM "StudentMediaConsent" c WHERE c.id = j."consentId"), jsonb_build_object('id', j."consentId")::text),
  "draftSnapshotJSON" = COALESCE((SELECT jsonb_build_object('id', d.id, 'status', d.status, 'subjects', d."subjectStudentIdsJSON", 'galleryPostId', d."galleryPostId", 'instagramMediaId', d."instagramMediaId", 'instagramPermalink', d."instagramPermalink")::text FROM "SocialPostDraft" d WHERE d.id = j."draftId"), jsonb_build_object('id', j."draftId")::text)
WHERE "studentSnapshotJSON" = '{}' OR "consentSnapshotJSON" = '{}' OR "draftSnapshotJSON" = '{}';

CREATE OR REPLACE FUNCTION stiz_guard_media_revocation_snapshot() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."studentSnapshotJSON" IS DISTINCT FROM OLD."studentSnapshotJSON"
    OR NEW."consentSnapshotJSON" IS DISTINCT FROM OLD."consentSnapshotJSON"
    OR NEW."draftSnapshotJSON" IS DISTINCT FROM OLD."draftSnapshotJSON" THEN
    RAISE EXCEPTION 'MediaRevocationJob snapshots are immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS "MediaRevocationJob_snapshot_immutable_trigger" ON "MediaRevocationJob";
CREATE TRIGGER "MediaRevocationJob_snapshot_immutable_trigger"
BEFORE UPDATE OF "studentSnapshotJSON", "consentSnapshotJSON", "draftSnapshotJSON"
ON "MediaRevocationJob" FOR EACH ROW EXECUTE FUNCTION stiz_guard_media_revocation_snapshot();
REVOKE ALL ON FUNCTION stiz_guard_media_revocation_snapshot() FROM PUBLIC;

DO $$
DECLARE fk RECORD;
BEGIN
  FOR fk IN SELECT conname FROM pg_constraint
    WHERE conrelid = '"MediaRevocationJob"'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE "MediaRevocationJob" DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END $$;
ALTER TABLE "MediaRevocationJob" DROP CONSTRAINT IF EXISTS "MediaRevocationJob_draftId_channel_key";
CREATE UNIQUE INDEX IF NOT EXISTS "MediaRevocationJob_consentId_draftId_channel_key"
  ON "MediaRevocationJob" ("consentId", "draftId", channel);

CREATE TABLE IF NOT EXISTS "SocialPublishAttempt" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "draftId" TEXT NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS "SocialPublishAttempt_idempotencyKey_key"
  ON "SocialPublishAttempt" ("idempotencyKey");
DO $$
DECLARE fk RECORD;
BEGIN
  FOR fk IN SELECT conname FROM pg_constraint
    WHERE conrelid = '"SocialPublishAttempt"'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE "SocialPublishAttempt" DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS "StorageDeletionJob" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  bucket TEXT NOT NULL, path TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','DELETED','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), "lockedAt" TIMESTAMPTZ(6), "lastError" TEXT,
  "deletedAt" TIMESTAMPTZ(6), "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  UNIQUE (bucket, path)
);
CREATE INDEX IF NOT EXISTS "StorageDeletionJob_status_nextAttemptAt_idx" ON "StorageDeletionJob" (status, "nextAttemptAt");
CREATE UNIQUE INDEX IF NOT EXISTS "StorageDeletionJob_bucket_path_key"
  ON "StorageDeletionJob" (bucket, path);
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
