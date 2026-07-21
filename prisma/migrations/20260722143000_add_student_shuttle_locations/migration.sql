CREATE TABLE IF NOT EXISTS "StudentShuttleLocation" (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "studentId" TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT,
  address TEXT NOT NULL,
  "roadAddress" TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  "placeId" TEXT,
  source TEXT,
  "accuracyMeters" DOUBLE PRECISION,
  "confirmedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "consentVersion" TEXT,
  note TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "StudentShuttleLocation_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentShuttleLocation_kind_check"
    CHECK (kind IN ('PICKUP', 'DROPOFF')),
  CONSTRAINT "StudentShuttleLocation_coordinate_check"
    CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180),
  CONSTRAINT "StudentShuttleLocation_studentId_kind_key"
    UNIQUE ("studentId", kind)
);

CREATE INDEX IF NOT EXISTS "StudentShuttleLocation_kind_confirmedAt_idx"
  ON "StudentShuttleLocation" (kind, "confirmedAt");

CREATE INDEX IF NOT EXISTS "StudentShuttleLocation_studentId_updatedAt_idx"
  ON "StudentShuttleLocation" ("studentId", "updatedAt");

ALTER TABLE "StudentShuttleLocation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "StudentShuttleLocation" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StudentShuttleLocation" TO service_role;
