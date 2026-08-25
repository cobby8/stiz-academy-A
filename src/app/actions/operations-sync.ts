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
