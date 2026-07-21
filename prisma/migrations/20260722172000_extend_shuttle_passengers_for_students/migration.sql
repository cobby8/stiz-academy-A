ALTER TABLE "ShuttleRoutePassenger"
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT 'SPECIAL_PROGRAM',
  ADD COLUMN IF NOT EXISTS "studentId" TEXT,
  ADD COLUMN IF NOT EXISTS "sessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "locationKind" TEXT;

ALTER TABLE "ShuttleRoutePassenger"
  ALTER COLUMN "shuttleRequestId" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ShuttleRoutePassenger_studentId_fkey'
  ) THEN
    ALTER TABLE "ShuttleRoutePassenger"
      ADD CONSTRAINT "ShuttleRoutePassenger_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ShuttleRoutePassenger_sessionId_fkey'
  ) THEN
    ALTER TABLE "ShuttleRoutePassenger"
      ADD CONSTRAINT "ShuttleRoutePassenger_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ShuttleRoutePassenger_sourceType_check'
  ) THEN
    ALTER TABLE "ShuttleRoutePassenger"
      ADD CONSTRAINT "ShuttleRoutePassenger_sourceType_check"
      CHECK ("sourceType" IN ('SPECIAL_PROGRAM', 'REGULAR_CLASS'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ShuttleRoutePassenger_locationKind_check'
  ) THEN
    ALTER TABLE "ShuttleRoutePassenger"
      ADD CONSTRAINT "ShuttleRoutePassenger_locationKind_check"
      CHECK ("locationKind" IS NULL OR "locationKind" IN ('PICKUP', 'DROPOFF'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ShuttleRoutePassenger_source_identity_check'
  ) THEN
    ALTER TABLE "ShuttleRoutePassenger"
      ADD CONSTRAINT "ShuttleRoutePassenger_source_identity_check"
      CHECK (
        (
          "sourceType" = 'SPECIAL_PROGRAM'
          AND "shuttleRequestId" IS NOT NULL
        )
        OR
        (
          "sourceType" = 'REGULAR_CLASS'
          AND "studentId" IS NOT NULL
          AND "sessionId" IS NOT NULL
          AND "locationKind" IS NOT NULL
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ShuttleRoutePassenger_studentId_sessionId_idx"
  ON "ShuttleRoutePassenger"("studentId", "sessionId");

CREATE INDEX IF NOT EXISTS "ShuttleRoutePassenger_routePlanId_sourceType_idx"
  ON "ShuttleRoutePassenger"("routePlanId", "sourceType");

CREATE UNIQUE INDEX IF NOT EXISTS "ShuttleRoutePassenger_route_regular_student_key"
  ON "ShuttleRoutePassenger"("routePlanId", "studentId", "sessionId", "locationKind")
  WHERE "sourceType" = 'REGULAR_CLASS';
