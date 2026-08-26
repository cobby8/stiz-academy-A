import { prisma } from "@/lib/prisma";

let infrastructureReady = false;

/**
 * 배포 순서와 무관하게 관리자 입력함을 열 수 있도록 필요한 원장 테이블을 준비한다.
 * 같은 SQL을 여러 번 실행해도 결과가 바뀌지 않는 IF NOT EXISTS 방식이다.
 */
export async function ensureOperationsSyncInfrastructure() {
  if (infrastructureReady) return;

  const statements = [
    `CREATE TABLE IF NOT EXISTS "OperationsRequest" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "sourceText" TEXT NOT NULL,
      "targetMonth" TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','PENDING','PARTIAL','SYNCED','HELD')),
      "requestedByUserId" TEXT NOT NULL REFERENCES "User"(id),
      "approvedByUserId" TEXT REFERENCES "User"(id),
      "approvedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "OperationsCommand" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "requestId" TEXT NOT NULL REFERENCES "OperationsRequest"(id) ON DELETE CASCADE,
      "idempotencyKey" TEXT NOT NULL,
      "sourceText" TEXT NOT NULL,
      "studentId" TEXT REFERENCES "Student"(id),
      "studentName" TEXT,
      kind TEXT NOT NULL,
      "effectiveMonth" TEXT NOT NULL,
      confidence TEXT NOT NULL CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','HELD','PARTIAL','SYNCED')),
      "holdReason" TEXT,
      "beforeJson" JSONB,
      "afterJson" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "RallyzAttendanceSyncItem_runId_idempotencyKey_key" ON "RallyzAttendanceSyncItem" ("runId", "idempotencyKey")`,
    `CREATE TABLE IF NOT EXISTS "OperationsSyncAttempt" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "commandId" TEXT NOT NULL REFERENCES "OperationsCommand"(id) ON DELETE CASCADE,
      target TEXT NOT NULL CHECK (target IN ('SHEET','RALLYZ','WEBSITE')),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUCCEEDED','FAILED','SKIPPED')),
      attempts INTEGER NOT NULL DEFAULT 0,
      "externalReference" TEXT,
      error TEXT,
      "verifiedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE ("commandId", target)
    )`,
    `CREATE TABLE IF NOT EXISTS "RallyzAttendanceSyncRun" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "sourceDate" DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'PREVIEW' CHECK (status IN ('PREVIEW','PARTIAL','APPLIED','HELD')),
      "sourceJson" JSONB NOT NULL,
      "requestedByUserId" TEXT NOT NULL REFERENCES "User"(id),
      "appliedByUserId" TEXT REFERENCES "User"(id),
      "appliedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "RallyzAttendanceSyncItem" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "runId" TEXT NOT NULL REFERENCES "RallyzAttendanceSyncRun"(id) ON DELETE CASCADE,
      "idempotencyKey" TEXT NOT NULL UNIQUE,
      "sourceDate" DATE NOT NULL,
      "rallyzClassId" TEXT,
      "sourceClassName" TEXT NOT NULL,
      "slotKey" TEXT,
      "studentName" TEXT NOT NULL,
      "managementName" TEXT,
      "sourceStatus" TEXT NOT NULL,
      "siteStatus" TEXT,
      "studentId" TEXT REFERENCES "Student"(id),
      "classId" TEXT REFERENCES "Class"(id),
      "sessionId" TEXT REFERENCES "Session"(id),
      "attendanceId" TEXT REFERENCES "Attendance"(id),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','HELD','APPLIED','SKIPPED')),
      "holdReason" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "OperationsRequest_status_createdAt_idx" ON "OperationsRequest" (status, "createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS "OperationsCommand_requestId_idx" ON "OperationsCommand" ("requestId")`,
    `CREATE INDEX IF NOT EXISTS "OperationsCommand_studentId_idx" ON "OperationsCommand" ("studentId")`,
    `CREATE INDEX IF NOT EXISTS "OperationsSyncAttempt_commandId_idx" ON "OperationsSyncAttempt" ("commandId")`,
    `CREATE INDEX IF NOT EXISTS "RallyzAttendanceSyncRun_createdAt_idx" ON "RallyzAttendanceSyncRun" ("createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS "RallyzAttendanceSyncItem_runId_idx" ON "RallyzAttendanceSyncItem" ("runId")`,
    `ALTER TABLE "OperationsRequest" ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT REFERENCES "User"(id)`,
    `ALTER TABLE "OperationsRequest" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ`,
    `ALTER TABLE "OperationsRequest" ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE "OperationsCommand" ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE "OperationsSyncAttempt" ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE "RallyzAttendanceSyncRun" ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE "RallyzAttendanceSyncItem" ENABLE ROW LEVEL SECURITY`,
    `REVOKE ALL ON "OperationsRequest", "OperationsCommand", "OperationsSyncAttempt", "RallyzAttendanceSyncRun", "RallyzAttendanceSyncItem" FROM anon, authenticated`,
  ];

  for (const statement of statements) await prisma.$executeRawUnsafe(statement);
  infrastructureReady = true;
}
