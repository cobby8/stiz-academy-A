-- Student Google Sheets import tables.
-- Apply this in the Supabase SQL editor or through a controlled DB push step.

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "basketballExp" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "hopeNote" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "agreementsJSON" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "sourceImportRowId" TEXT;

CREATE INDEX IF NOT EXISTS "Student_branch_idx" ON "Student" (branch);
CREATE INDEX IF NOT EXISTS "Student_sourceImportRowId_idx" ON "Student" ("sourceImportRowId");

CREATE TABLE IF NOT EXISTS "StudentSheetImportBatch" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    source TEXT NOT NULL DEFAULT 'GOOGLE_SHEETS',
    "spreadsheetId" TEXT,
    "spreadsheetTitle" TEXT,
    "sourceUrl" TEXT,
    "importedBy" TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "registrationRows" INTEGER NOT NULL DEFAULT 0,
    "vehicleRows" INTEGER NOT NULL DEFAULT 0,
    "changeRows" INTEGER NOT NULL DEFAULT 0,
    "teamRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "rawSummaryJSON" TEXT,
    message TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "completedAt" TIMESTAMPTZ(6)
);

CREATE TABLE IF NOT EXISTS "StudentSheetRawRow" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "batchId" TEXT NOT NULL REFERENCES "StudentSheetImportBatch"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    "sheetName" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rowHash" TEXT,
    "studentKey" TEXT,
    "studentId" TEXT REFERENCES "Student"(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    "rawJSON" TEXT NOT NULL,
    "normalizedJSON" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "StudentSheetRawRow_batch_sheet_row_key" UNIQUE ("batchId", "sheetName", "rowNumber")
);

CREATE TABLE IF NOT EXISTS "StudentRegistrationLedger" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "batchId" TEXT NOT NULL REFERENCES "StudentSheetImportBatch"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    "rawRowId" TEXT REFERENCES "StudentSheetRawRow"(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    "studentId" TEXT REFERENCES "Student"(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    "parentUserId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "studentKey" TEXT,
    branch TEXT,
    "applicationAt" TIMESTAMPTZ(6),
    "paymentDate" TIMESTAMPTZ(6),
    "registrationMonth" TEXT,
    "studentName" TEXT NOT NULL,
    "studentGender" TEXT,
    grade TEXT,
    "uniformStatus" TEXT,
    "paymentMethod" TEXT,
    "paymentAmount" INTEGER,
    "tuitionAmount" INTEGER,
    "shuttleFee" INTEGER,
    "carryOverAmount" INTEGER,
    "shuttleNeeded" BOOLEAN NOT NULL DEFAULT false,
    "shuttlePickup" TEXT,
    "shuttlePreferredTime" TEXT,
    "shuttleDropoff" TEXT,
    "selectedSlotKeysJSON" TEXT NOT NULL DEFAULT '[]',
    "birthDate" TIMESTAMPTZ(6),
    "parentName" TEXT,
    "studentPhone" TEXT,
    "parentPhone" TEXT,
    address TEXT,
    school TEXT,
    "basketballExp" TEXT,
    "hopeNote" TEXT,
    "referralSource" TEXT,
    "agreedPrivacy" BOOLEAN NOT NULL DEFAULT false,
    "agreedTerms" BOOLEAN NOT NULL DEFAULT false,
    "agreementJSON" TEXT NOT NULL DEFAULT '{}',
    "enrollmentPeriod" TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    "rawJSON" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "StudentRegistrationLedger_batch_row_key" UNIQUE ("batchId", "rowNumber")
);

CREATE TABLE IF NOT EXISTS "StudentShuttleRide" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "batchId" TEXT NOT NULL REFERENCES "StudentSheetImportBatch"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    "rawRowId" TEXT REFERENCES "StudentSheetRawRow"(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    "studentId" TEXT REFERENCES "Student"(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    "monthLabel" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "studentName" TEXT,
    "studentPhone" TEXT,
    "parentPhone" TEXT,
    "dayLabel" TEXT,
    "classTime" TEXT,
    "arrivalTime" TEXT,
    destination TEXT,
    note TEXT,
    memo TEXT,
    "rawJSON" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "StudentShuttleRide_batch_month_row_key" UNIQUE ("batchId", "monthLabel", "rowNumber")
);

CREATE TABLE IF NOT EXISTS "StudentChangeLog" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "batchId" TEXT NOT NULL REFERENCES "StudentSheetImportBatch"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    "rawRowId" TEXT REFERENCES "StudentSheetRawRow"(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    "rowNumber" INTEGER NOT NULL,
    "occurredAt" TIMESTAMPTZ(6),
    "changeSummary" TEXT,
    "registrationReflected" BOOLEAN NOT NULL DEFAULT false,
    "rallyzReflected" BOOLEAN NOT NULL DEFAULT false,
    "vehicleReflected" BOOLEAN NOT NULL DEFAULT false,
    "alarmStatus" TEXT,
    note TEXT,
    "rawJSON" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "StudentChangeLog_batch_row_key" UNIQUE ("batchId", "rowNumber")
);

CREATE TABLE IF NOT EXISTS "StudentTeamRosterEntry" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "batchId" TEXT NOT NULL REFERENCES "StudentSheetImportBatch"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    "rawRowId" TEXT REFERENCES "StudentSheetRawRow"(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    "studentId" TEXT REFERENCES "Student"(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    "rowNumber" INTEGER NOT NULL,
    "studentName" TEXT NOT NULL,
    "birthDate" TIMESTAMPTZ(6),
    "jerseyNumber" TEXT,
    phone TEXT,
    grade TEXT,
    branch TEXT,
    "eventColumnsJSON" TEXT NOT NULL DEFAULT '{}',
    "rawJSON" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "StudentTeamRosterEntry_batch_row_key" UNIQUE ("batchId", "rowNumber")
);

CREATE TABLE IF NOT EXISTS "StudentSheetImportIssue" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "batchId" TEXT NOT NULL REFERENCES "StudentSheetImportBatch"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    "sheetName" TEXT,
    "rowNumber" INTEGER,
    severity TEXT NOT NULL DEFAULT 'ERROR',
    message TEXT NOT NULL,
    "rawJSON" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "StudentSheetImportBatch_status_createdAt_idx"
    ON "StudentSheetImportBatch" (status, "createdAt");
CREATE INDEX IF NOT EXISTS "StudentSheetImportBatch_source_createdAt_idx"
    ON "StudentSheetImportBatch" (source, "createdAt");
CREATE INDEX IF NOT EXISTS "StudentSheetImportBatch_spreadsheetId_idx"
    ON "StudentSheetImportBatch" ("spreadsheetId");

CREATE INDEX IF NOT EXISTS "StudentSheetRawRow_batchId_idx" ON "StudentSheetRawRow" ("batchId");
CREATE INDEX IF NOT EXISTS "StudentSheetRawRow_sheetName_idx" ON "StudentSheetRawRow" ("sheetName");
CREATE INDEX IF NOT EXISTS "StudentSheetRawRow_studentKey_idx" ON "StudentSheetRawRow" ("studentKey");
CREATE INDEX IF NOT EXISTS "StudentSheetRawRow_studentId_idx" ON "StudentSheetRawRow" ("studentId");
CREATE INDEX IF NOT EXISTS "StudentSheetRawRow_rowHash_idx" ON "StudentSheetRawRow" ("rowHash");

CREATE INDEX IF NOT EXISTS "StudentRegistrationLedger_batchId_idx" ON "StudentRegistrationLedger" ("batchId");
CREATE INDEX IF NOT EXISTS "StudentRegistrationLedger_rawRowId_idx" ON "StudentRegistrationLedger" ("rawRowId");
CREATE INDEX IF NOT EXISTS "StudentRegistrationLedger_studentId_idx" ON "StudentRegistrationLedger" ("studentId");
CREATE INDEX IF NOT EXISTS "StudentRegistrationLedger_studentKey_idx" ON "StudentRegistrationLedger" ("studentKey");
CREATE INDEX IF NOT EXISTS "StudentRegistrationLedger_registrationMonth_idx" ON "StudentRegistrationLedger" ("registrationMonth");
CREATE INDEX IF NOT EXISTS "StudentRegistrationLedger_status_idx" ON "StudentRegistrationLedger" (status);

CREATE INDEX IF NOT EXISTS "StudentShuttleRide_batchId_idx" ON "StudentShuttleRide" ("batchId");
CREATE INDEX IF NOT EXISTS "StudentShuttleRide_rawRowId_idx" ON "StudentShuttleRide" ("rawRowId");
CREATE INDEX IF NOT EXISTS "StudentShuttleRide_studentId_idx" ON "StudentShuttleRide" ("studentId");
CREATE INDEX IF NOT EXISTS "StudentShuttleRide_monthLabel_idx" ON "StudentShuttleRide" ("monthLabel");
CREATE INDEX IF NOT EXISTS "StudentShuttleRide_dayLabel_idx" ON "StudentShuttleRide" ("dayLabel");

CREATE INDEX IF NOT EXISTS "StudentChangeLog_batchId_idx" ON "StudentChangeLog" ("batchId");
CREATE INDEX IF NOT EXISTS "StudentChangeLog_rawRowId_idx" ON "StudentChangeLog" ("rawRowId");
CREATE INDEX IF NOT EXISTS "StudentChangeLog_occurredAt_idx" ON "StudentChangeLog" ("occurredAt");

CREATE INDEX IF NOT EXISTS "StudentTeamRosterEntry_batchId_idx" ON "StudentTeamRosterEntry" ("batchId");
CREATE INDEX IF NOT EXISTS "StudentTeamRosterEntry_rawRowId_idx" ON "StudentTeamRosterEntry" ("rawRowId");
CREATE INDEX IF NOT EXISTS "StudentTeamRosterEntry_studentId_idx" ON "StudentTeamRosterEntry" ("studentId");
CREATE INDEX IF NOT EXISTS "StudentTeamRosterEntry_branch_idx" ON "StudentTeamRosterEntry" (branch);

CREATE INDEX IF NOT EXISTS "StudentSheetImportIssue_batchId_idx" ON "StudentSheetImportIssue" ("batchId");
CREATE INDEX IF NOT EXISTS "StudentSheetImportIssue_sheetName_idx" ON "StudentSheetImportIssue" ("sheetName");
CREATE INDEX IF NOT EXISTS "StudentSheetImportIssue_severity_idx" ON "StudentSheetImportIssue" (severity);

ALTER TABLE "StudentSheetImportBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentSheetRawRow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentRegistrationLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentShuttleRide" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentChangeLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentTeamRosterEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentSheetImportIssue" ENABLE ROW LEVEL SECURITY;

-- These tables contain student PII. Keep them private to trusted server code.
REVOKE ALL ON TABLE "StudentSheetImportBatch" FROM anon, authenticated;
REVOKE ALL ON TABLE "StudentSheetRawRow" FROM anon, authenticated;
REVOKE ALL ON TABLE "StudentRegistrationLedger" FROM anon, authenticated;
REVOKE ALL ON TABLE "StudentShuttleRide" FROM anon, authenticated;
REVOKE ALL ON TABLE "StudentChangeLog" FROM anon, authenticated;
REVOKE ALL ON TABLE "StudentTeamRosterEntry" FROM anon, authenticated;
REVOKE ALL ON TABLE "StudentSheetImportIssue" FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StudentSheetImportBatch" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StudentSheetRawRow" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StudentRegistrationLedger" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StudentShuttleRide" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StudentChangeLog" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StudentTeamRosterEntry" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StudentSheetImportIssue" TO service_role;
