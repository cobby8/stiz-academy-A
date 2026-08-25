"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { parseOperationsRequest, SYNC_TARGETS } from "@/lib/operationsSync";
import { ensureOperationsSyncInfrastructure } from "@/lib/operationsSyncInfrastructure";

type OperationsRequestRow = {
  id: string;
  sourceText: string;
  targetMonth: string;
  status: string;
  createdAt: Date | string;
  commands: Array<{
    id: string;
    studentName: string | null;
    kind: string;
    effectiveMonth: string;
    confidence: string;
    status: string;
    holdReason: string | null;
    beforeJson: { enrollments?: Array<{ id: string; status: string; className: string }> } | null;
    afterJson: { enrollments?: Array<{ id: string; status: string; className: string }> } | null;
    targets: Array<{ target: "SHEET" | "RALLYZ" | "WEBSITE"; status: string }>;
  }>;
};

export async function createOperationsRequest(sourceText: string, targetMonth: string) {
  const admin = await requireAdmin();
  const text = sourceText.trim();
  if (!text) throw new Error("학부모 요청 내용을 입력해 주세요.");
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(targetMonth)) throw new Error("적용 월을 확인해 주세요.");

  const parsed = parseOperationsRequest(text, targetMonth);
  if (parsed.length === 0) throw new Error("처리할 요청을 찾지 못했습니다.");
  await ensureOperationsSyncInfrastructure();

  const placeholders = parsed.map((_, index) => `$${index + 1}`).join(",");
  const duplicates = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "OperationsCommand" WHERE "idempotencyKey" IN (${placeholders}) LIMIT 1`,
    ...parsed.map((command) => command.idempotencyKey),
  );
  if (duplicates.length > 0) throw new Error("이미 저장된 동일 요청이 있습니다. 기존 요청의 처리 상태를 확인해 주세요.");

  const requestId = crypto.randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO "OperationsRequest" (id,"sourceText","targetMonth",status,"requestedByUserId") VALUES ($1,$2,$3,'DRAFT',$4)`,
      requestId, text, targetMonth, admin.appUserId,
    );

    for (const command of parsed) {
      const students = command.studentName
        ? await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT id FROM "Student" WHERE name = $1 AND "mergedIntoStudentId" IS NULL ORDER BY "createdAt" DESC LIMIT 2`,
            command.studentName,
          )
        : [];
      const identityIssue = students.length === 0
        ? "홈페이지에서 학생을 찾지 못했습니다."
        : students.length > 1
          ? "동명이인이 있어 학생을 확정해야 합니다."
          : null;
      const holdReason = [command.holdReason, identityIssue].filter(Boolean).join(" ") || null;
      const commandId = crypto.randomUUID();

      await tx.$executeRawUnsafe(
        `INSERT INTO "OperationsCommand"
          (id,"requestId","idempotencyKey","sourceText","studentId","studentName",kind,"effectiveMonth",confidence,status,"holdReason")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT ("idempotencyKey") DO NOTHING`,
        commandId, requestId, command.idempotencyKey, command.sourceText,
        students.length === 1 ? students[0].id : null, command.studentName, command.kind,
        command.effectiveMonth, holdReason ? "LOW" : command.confidence, holdReason ? "HELD" : "PENDING", holdReason,
      );

      for (const target of SYNC_TARGETS) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "OperationsSyncAttempt" (id,"commandId",target,status)
           SELECT $1,$2,$3,'PENDING'
           WHERE EXISTS (SELECT 1 FROM "OperationsCommand" WHERE id = $2)
           ON CONFLICT ("commandId",target) DO NOTHING`,
          crypto.randomUUID(), commandId, target,
        );
      }
    }
  });

  revalidatePath("/admin/operations-sync");
  return { ok: true as const, requestId, commandCount: parsed.length };
}

export async function getOperationsRequests() {
  await requireAdmin();
  await ensureOperationsSyncInfrastructure();
  const rows = await prisma.$queryRawUnsafe<OperationsRequestRow[]>(
    `SELECT r.id, r."sourceText", r."targetMonth", r.status, r."createdAt",
            COALESCE(json_agg(json_build_object(
              'id', c.id, 'studentName', c."studentName", 'kind', c.kind,
              'effectiveMonth', c."effectiveMonth", 'confidence', c.confidence,
              'status', c.status, 'holdReason', c."holdReason",
              'beforeJson', c."beforeJson", 'afterJson', c."afterJson",
              'targets', (SELECT json_agg(json_build_object('target',a.target,'status',a.status) ORDER BY a.target)
                            FROM "OperationsSyncAttempt" a WHERE a."commandId" = c.id)
            ) ORDER BY c."createdAt") FILTER (WHERE c.id IS NOT NULL), '[]'::json) AS commands
       FROM "OperationsRequest" r
       LEFT JOIN "OperationsCommand" c ON c."requestId" = r.id
      GROUP BY r.id
      ORDER BY r."createdAt" DESC
      LIMIT 50`,
  );
  return rows.map((row) => ({ ...row, createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt }));
}

type PreviewEnrollment = { id: string; status: string; className: string };

export async function approveOperationsRequest(requestId: string) {
  const admin = await requireAdmin();
  await ensureOperationsSyncInfrastructure();
  const commands = await prisma.$queryRawUnsafe<Array<{ id: string; studentId: string | null; kind: string; status: string }>>(
    `SELECT id, "studentId", kind, status FROM "OperationsCommand" WHERE "requestId" = $1 ORDER BY "createdAt"`,
    requestId,
  );
  if (commands.length === 0) throw new Error("승인할 변경 명령이 없습니다.");

  let ready = 0;
  await prisma.$transaction(async (tx) => {
    for (const command of commands) {
      if (command.status === "HELD" || !command.studentId) continue;
      if (!['PAUSE', 'WITHDRAW'].includes(command.kind)) {
        await tx.$executeRawUnsafe(
          `UPDATE "OperationsCommand" SET status='HELD', "holdReason"='대상 반·노선·금액을 확정하는 전용 어댑터가 필요합니다.', "updatedAt"=now() WHERE id=$1`,
          command.id,
        );
        continue;
      }
      const enrollments = await tx.$queryRawUnsafe<PreviewEnrollment[]>(
        `SELECT e.id, e.status, c.name AS "className" FROM "Enrollment" e JOIN "Class" c ON c.id=e."classId"
          WHERE e."studentId"=$1 AND e.status IN ('ACTIVE','PAUSED') ORDER BY c.name`,
        command.studentId,
      );
      if (enrollments.length === 0) {
        await tx.$executeRawUnsafe(
          `UPDATE "OperationsCommand" SET status='HELD', "holdReason"='변경할 현재 수강 등록이 없습니다.', "updatedAt"=now() WHERE id=$1`, command.id,
        );
        continue;
      }
      const nextStatus = command.kind === "PAUSE" ? "PAUSED" : "WITHDRAWN";
      await tx.$executeRawUnsafe(
        `UPDATE "OperationsCommand" SET "beforeJson"=$2::jsonb, "afterJson"=$3::jsonb, confidence='HIGH', status='PENDING', "holdReason"=NULL, "updatedAt"=now() WHERE id=$1`,
        command.id,
        JSON.stringify({ enrollments }),
        JSON.stringify({ enrollments: enrollments.map((row) => ({ ...row, status: nextStatus })) }),
      );
      ready += 1;
    }
    await tx.$executeRawUnsafe(
      `UPDATE "OperationsRequest" SET status=$2, "approvedByUserId"=$3, "approvedAt"=now(), "updatedAt"=now() WHERE id=$1`,
      requestId, ready > 0 ? "APPROVED" : "HELD", admin.appUserId,
    );
  });
  revalidatePath("/admin/operations-sync");
  return { ok: true as const, ready };
}

export async function applyOperationsWebsite(requestId: string) {
  await requireAdmin();
  await ensureOperationsSyncInfrastructure();
  const requests = await prisma.$queryRawUnsafe<Array<{ status: string; targetMonth: string }>>(
    `SELECT status, "targetMonth" FROM "OperationsRequest" WHERE id=$1`, requestId,
  );
  if (!requests[0] || !['APPROVED', 'PARTIAL', 'PENDING'].includes(requests[0].status)) throw new Error("먼저 변경 계획을 승인해 주세요.");
  const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  if (requests[0].targetMonth > currentMonth) throw new Error("미래 적용 월은 시작된 뒤 홈페이지 상태를 변경해 주세요.");

  const commands = await prisma.$queryRawUnsafe<Array<{ id: string; afterJson: { enrollments?: Array<{ id: string; status: string }> } | null }>>(
    `SELECT c.id, c."afterJson" FROM "OperationsCommand" c
      JOIN "OperationsSyncAttempt" a ON a."commandId"=c.id AND a.target='WEBSITE'
      WHERE c."requestId"=$1 AND c.status IN ('PENDING','PARTIAL') AND a.status='PENDING'
        AND NOT EXISTS (
          SELECT 1 FROM "OperationsSyncAttempt" pending
          WHERE pending."commandId"=c.id AND pending.target IN ('SHEET','RALLYZ') AND pending.status <> 'SUCCEEDED'
        )`, requestId,
  );
  if (commands.length === 0) throw new Error("먼저 시트와 랠리즈의 실제 반영을 모두 확인해 주세요.");
  let applied = 0;
  await prisma.$transaction(async (tx) => {
    for (const command of commands) {
      const rows = command.afterJson?.enrollments || [];
      if (rows.length === 0) continue;
      for (const row of rows) {
        await tx.$executeRawUnsafe(`UPDATE "Enrollment" SET status=$2, "updatedAt"=now() WHERE id=$1`, row.id, row.status);
      }
      await tx.$executeRawUnsafe(
        `UPDATE "OperationsSyncAttempt" SET status='SUCCEEDED', attempts=attempts+1, "verifiedAt"=now(), "updatedAt"=now() WHERE "commandId"=$1 AND target='WEBSITE'`, command.id,
      );
      applied += 1;
    }
  });
  for (const command of commands) await refreshOperationsStatuses(command.id);
  revalidatePath("/admin/operations-sync");
  return { ok: true as const, applied };
}

export async function recordOperationsExternalCheck(commandId: string, target: "SHEET" | "RALLYZ", succeeded: boolean) {
  await requireAdmin();
  await ensureOperationsSyncInfrastructure();
  await prisma.$executeRawUnsafe(
    `UPDATE "OperationsSyncAttempt" SET status=$3, attempts=attempts+1, "verifiedAt"=CASE WHEN $3='SUCCEEDED' THEN now() ELSE NULL END, "updatedAt"=now()
      WHERE "commandId"=$1 AND target=$2`, commandId, target, succeeded ? "SUCCEEDED" : "FAILED",
  );
  await refreshOperationsStatuses(commandId);
  revalidatePath("/admin/operations-sync");
  return { ok: true as const };
}

async function refreshOperationsStatuses(commandId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ requestId: string; statuses: string[] }>>(
    `SELECT c."requestId", array_agg(a.status ORDER BY a.target) AS statuses FROM "OperationsCommand" c
      JOIN "OperationsSyncAttempt" a ON a."commandId"=c.id WHERE c.id=$1 GROUP BY c."requestId"`, commandId,
  );
  const row = rows[0];
  if (!row) return;
  const commandStatus = row.statuses.some((value) => value === "FAILED") ? "PARTIAL" : row.statuses.every((value) => value === "SUCCEEDED") ? "SYNCED" : "PENDING";
  await prisma.$executeRawUnsafe(`UPDATE "OperationsCommand" SET status=$2, "updatedAt"=now() WHERE id=$1`, commandId, commandStatus);
  const requestStatuses = await prisma.$queryRawUnsafe<Array<{ status: string }>>(`SELECT status FROM "OperationsCommand" WHERE "requestId"=$1`, row.requestId);
  const hasHeld = requestStatuses.some((item) => item.status === "HELD");
  const hasPartial = requestStatuses.some((item) => item.status === "PARTIAL");
  const allHeld = requestStatuses.every((item) => item.status === "HELD");
  const requestStatus = allHeld ? "HELD" : hasHeld || hasPartial ? "PARTIAL" : requestStatuses.every((item) => item.status === "SYNCED") ? "SYNCED" : "PENDING";
  await prisma.$executeRawUnsafe(`UPDATE "OperationsRequest" SET status=$2, "updatedAt"=now() WHERE id=$1`, row.requestId, requestStatus);
}
