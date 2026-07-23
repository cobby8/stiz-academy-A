ALTER TABLE "EnrollmentApplication"
  ADD COLUMN IF NOT EXISTS "parentUserId" TEXT;

CREATE INDEX IF NOT EXISTS "EnrollmentApplication_parentUserId_idx"
  ON "EnrollmentApplication"("parentUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'EnrollmentApplication_parentUserId_fkey'
  ) THEN
    ALTER TABLE "EnrollmentApplication"
      ADD CONSTRAINT "EnrollmentApplication_parentUserId_fkey"
      FOREIGN KEY ("parentUserId") REFERENCES "User"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "EnrollmentAccountHandoff" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "enrollmentApplicationId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "phoneHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "consumedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "EnrollmentAccountHandoff_enrollmentApplicationId_fkey"
    FOREIGN KEY ("enrollmentApplicationId") REFERENCES "EnrollmentApplication"(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EnrollmentAccountHandoff_enrollmentApplicationId_expiresAt_idx"
  ON "EnrollmentAccountHandoff"("enrollmentApplicationId", "expiresAt");

ALTER TABLE "EnrollmentAccountHandoff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EnrollmentAccountHandoff" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "EnrollmentAccountHandoff" FROM anon, authenticated;
