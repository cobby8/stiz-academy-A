-- DB-first schedule operation tables.
-- Apply this in the Supabase SQL editor or through a controlled DB push step.

CREATE TABLE IF NOT EXISTS "ScheduleImportBatch" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    source TEXT NOT NULL DEFAULT 'GOOGLE_SHEETS',
    "sourceUrl" TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    "importedBy" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    "rawSummaryJSON" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "completedAt" TIMESTAMPTZ(6)
);

CREATE TABLE IF NOT EXISTS "ScheduleImportIssue" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "batchId" TEXT NOT NULL REFERENCES "ScheduleImportBatch"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    "rowNumber" INTEGER,
    "slotKey" TEXT,
    severity TEXT NOT NULL DEFAULT 'ERROR',
    message TEXT NOT NULL,
    "rawJSON" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ScheduleSlot" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "slotKey" TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'DB',
    period INTEGER,
    "dayKey" TEXT NOT NULL,
    "dayLabel" TEXT,
    "isWeekend" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    label TEXT,
    "gradeRange" TEXT,
    "gradesJSON" TEXT NOT NULL DEFAULT '[]',
    "enrolledSnapshot" INTEGER NOT NULL DEFAULT 0,
    capacity INTEGER NOT NULL DEFAULT 12,
    note TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "activeFrom" TIMESTAMPTZ(6),
    "activeTo" TIMESTAMPTZ(6),
    "coachId" TEXT REFERENCES "Coach"(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    "programId" TEXT REFERENCES "Program"(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    "importBatchId" TEXT REFERENCES "ScheduleImportBatch"(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    "rawJSON" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ScheduleImportBatch_status_createdAt_idx"
    ON "ScheduleImportBatch" (status, "createdAt");

CREATE INDEX IF NOT EXISTS "ScheduleImportBatch_source_createdAt_idx"
    ON "ScheduleImportBatch" (source, "createdAt");

CREATE INDEX IF NOT EXISTS "ScheduleImportIssue_batchId_idx"
    ON "ScheduleImportIssue" ("batchId");

CREATE INDEX IF NOT EXISTS "ScheduleImportIssue_severity_idx"
    ON "ScheduleImportIssue" (severity);

CREATE INDEX IF NOT EXISTS "ScheduleImportIssue_slotKey_idx"
    ON "ScheduleImportIssue" ("slotKey");

CREATE INDEX IF NOT EXISTS "ScheduleSlot_dayKey_startTime_idx"
    ON "ScheduleSlot" ("dayKey", "startTime");

CREATE INDEX IF NOT EXISTS "ScheduleSlot_isHidden_idx"
    ON "ScheduleSlot" ("isHidden");

CREATE INDEX IF NOT EXISTS "ScheduleSlot_coachId_idx"
    ON "ScheduleSlot" ("coachId");

CREATE INDEX IF NOT EXISTS "ScheduleSlot_programId_idx"
    ON "ScheduleSlot" ("programId");

CREATE INDEX IF NOT EXISTS "ScheduleSlot_importBatchId_idx"
    ON "ScheduleSlot" ("importBatchId");

CREATE INDEX IF NOT EXISTS "ScheduleSlot_source_idx"
    ON "ScheduleSlot" (source);

ALTER TABLE "ScheduleImportBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduleImportIssue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduleSlot" ENABLE ROW LEVEL SECURITY;

-- These tables are operated through trusted server code. Keep them hidden from
-- anon/authenticated Data API access unless a later public policy is added.
REVOKE ALL ON TABLE "ScheduleImportBatch" FROM anon, authenticated;
REVOKE ALL ON TABLE "ScheduleImportIssue" FROM anon, authenticated;
REVOKE ALL ON TABLE "ScheduleSlot" FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ScheduleImportBatch" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ScheduleImportIssue" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ScheduleSlot" TO service_role;
