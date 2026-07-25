-- 방학특강 출석·보강 개편: 수강일(EnrollmentDate) + 보강(Makeup) 테이블 추가 (멱등)
-- 기존 테이블은 변경하지 않음 (CREATE ONLY).

CREATE TABLE IF NOT EXISTS "SpecialProgramEnrollmentDate" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "applicationItemId" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "sessionDateId" TEXT NOT NULL,
  "studentId" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'REGULAR',
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "makeupId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "SpecialProgramEnrollmentDate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SPED_item_date_key" ON "SpecialProgramEnrollmentDate" ("applicationItemId","sessionDateId");
CREATE INDEX IF NOT EXISTS "SPED_sessionDate_status_idx" ON "SpecialProgramEnrollmentDate" ("sessionDateId","status");
CREATE INDEX IF NOT EXISTS "SPED_offering_idx" ON "SpecialProgramEnrollmentDate" ("offeringId");
CREATE INDEX IF NOT EXISTS "SPED_student_idx" ON "SpecialProgramEnrollmentDate" ("studentId");
CREATE INDEX IF NOT EXISTS "SPED_makeup_idx" ON "SpecialProgramEnrollmentDate" ("makeupId");

CREATE TABLE IF NOT EXISTS "SpecialProgramMakeup" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "applicationItemId" TEXT NOT NULL,
  "studentId" TEXT,
  "offeringId" TEXT NOT NULL,
  "absentSessionDateId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL DEFAULT 'SEASONAL',
  "targetSessionDateId" TEXT,
  "targetClassId" TEXT,
  "targetSessionId" TEXT,
  "targetDate" TIMESTAMPTZ(6),
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "requestedBy" TEXT NOT NULL DEFAULT 'PARENT',
  "requestedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "decidedAt" TIMESTAMPTZ(6),
  "note" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "SpecialProgramMakeup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SPM_offering_status_idx" ON "SpecialProgramMakeup" ("offeringId","status");
CREATE INDEX IF NOT EXISTS "SPM_absent_idx" ON "SpecialProgramMakeup" ("absentSessionDateId");
CREATE INDEX IF NOT EXISTS "SPM_item_idx" ON "SpecialProgramMakeup" ("applicationItemId");
CREATE INDEX IF NOT EXISTS "SPM_student_idx" ON "SpecialProgramMakeup" ("studentId");
CREATE INDEX IF NOT EXISTS "SPM_status_requested_idx" ON "SpecialProgramMakeup" ("status","requestedAt");
