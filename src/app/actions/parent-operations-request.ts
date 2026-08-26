"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { operationsRequestKey, parseOperationsRequest, SYNC_TARGETS } from "@/lib/operationsSync";
import { ensureOperationsSyncInfrastructure } from "@/lib/operationsSyncInfrastructure";

export type ParentOperationsLinkPreview = {
  status: "ACTIVE";
  studentName: string;
  expiresAt: string;
} | { status: "EXPIRED" | "INVALID" };

export type ActiveParentOperationsLink = {
  id: string;
  studentName: string;
  expiresAt: string;
  createdAt: string;
};

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createParentOperationsRequestLink(studentId: string, expiresInDays = 7) {
  const admin = await requireAdmin();
  if (!studentId) throw new Error("학생을 선택해 주세요.");
  if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) {
    throw new Error("요청 링크 유효기간은 1~30일이어야 합니다.");
  }
  await ensureOperationsSyncInfrastructure();
  const students = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `SELECT id,name FROM "Student" WHERE id=$1 AND "mergedIntoStudentId" IS NULL LIMIT 1`, studentId,
  );
  if (!students[0]) throw new Error("학생을 찾지 못했습니다.");

  const token = randomBytes(32).toString("base64url");
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO "ParentOperationsRequestLink" (id,"studentId","tokenHash","expiresAt","createdByUserId") VALUES ($1,$2,$3,$4,$5)`,
      id, studentId, tokenHash(token), expiresAt, admin.appUserId,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "OperationsAuditLog" (id,"linkId",action,"actorType","actorUserId","detailsJson") VALUES ($1,$2,'LINK_CREATED','ADMIN',$3,$4::jsonb)`,
      crypto.randomUUID(), id, admin.appUserId, JSON.stringify({ expiresAt: expiresAt.toISOString() }),
    );
  });
  return { ok: true as const, token, studentName: students[0].name, expiresAt: expiresAt.toISOString() };
}

export async function getActiveParentOperationsRequestLinks(): Promise<ActiveParentOperationsLink[]> {
  await requireAdmin();
  await ensureOperationsSyncInfrastructure();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; studentName: string; expiresAt: Date; createdAt: Date }>>(
    `SELECT l.id,s.name AS "studentName",l."expiresAt",l."createdAt"
       FROM "ParentOperationsRequestLink" l JOIN "Student" s ON s.id=l."studentId"
      WHERE l."revokedAt" IS NULL AND l."expiresAt">now()
      ORDER BY l."createdAt" DESC LIMIT 100`,
  );
  return rows.map((row) => ({ ...row, expiresAt: row.expiresAt.toISOString(), createdAt: row.createdAt.toISOString() }));
}

export async function getParentOperationsLinkPreview(token: string): Promise<ParentOperationsLinkPreview> {
  if (!token || token.length > 200) return { status: "INVALID" };
  await ensureOperationsSyncInfrastructure();
  const rows = await prisma.$queryRawUnsafe<Array<{ studentName: string; expiresAt: Date; revokedAt: Date | null }>>(
    `SELECT s.name AS "studentName", l."expiresAt", l."revokedAt" FROM "ParentOperationsRequestLink" l
      JOIN "Student" s ON s.id=l."studentId"
     WHERE l."tokenHash"=$1 LIMIT 1`, tokenHash(token),
  );
  const row = rows[0];
  if (!row || row.revokedAt) return { status: "INVALID" };
  if (row.expiresAt.getTime() <= Date.now()) return { status: "EXPIRED" };
  return { status: "ACTIVE", studentName: row.studentName, expiresAt: row.expiresAt.toISOString() };
}

export async function submitParentOperationsRequest(token: string, sourceText: string, targetMonth: string) {
  const text = sourceText.trim().replace(/\r\n/g, "\n");
  if (!token || token.length > 200) throw new Error("유효하지 않은 요청 링크입니다.");
  if (!text || text.length > 2000) throw new Error("요청 내용은 1~2,000자로 입력해 주세요.");
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(targetMonth)) throw new Error("적용 월을 확인해 주세요.");
  await ensureOperationsSyncInfrastructure();

  const links = await prisma.$queryRawUnsafe<Array<{ id: string; studentId: string; studentName: string; createdByUserId: string }>>(
    `SELECT l.id,l."studentId",s.name AS "studentName",l."createdByUserId" FROM "ParentOperationsRequestLink" l
      JOIN "Student" s ON s.id=l."studentId"
     WHERE l."tokenHash"=$1 AND l."revokedAt" IS NULL AND l."expiresAt">now() LIMIT 1`, tokenHash(token),
  );
  const link = links[0];
  if (!link) throw new Error("요청 링크가 만료되었거나 취소되었습니다.");

  const parsed = parseOperationsRequest(text, targetMonth);
  if (!parsed.length) throw new Error("처리할 요청을 찾지 못했습니다.");
  const requestId = crypto.randomUUID();
  const commands = parsed.map((command) => ({
    ...command,
    studentName: link.studentName,
    idempotencyKey: operationsRequestKey({
      sourceText: command.sourceText,
      studentName: link.studentName,
      kind: command.kind,
      effectiveMonth: command.effectiveMonth,
      scope: `PARENT_LINK:${link.id}`,
    }),
  }));

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.$executeRawUnsafe(
        `UPDATE "ParentOperationsRequestLink" SET "revokedAt"=now(),"lastUsedAt"=now(),"updatedAt"=now()
          WHERE id=$1 AND "revokedAt" IS NULL AND "expiresAt">now()`, link.id,
      );
      if (claimed !== 1) throw new Error("REQUEST_LINK_ALREADY_USED");
      await tx.$executeRawUnsafe(
        `INSERT INTO "OperationsRequest" (id,"sourceText","targetMonth",status,"requestedByUserId","parentRequestLinkId","submittedAt")
         VALUES ($1,$2,$3,'DRAFT',$4,$5,now())`, requestId, text, targetMonth, link.createdByUserId, link.id,
      );
      for (const command of commands) {
        const commandId = crypto.randomUUID();
        const holdReason = command.holdReason || (command.kind === "UNKNOWN" ? "변경 종류를 확인해야 합니다." : null);
        await tx.$executeRawUnsafe(
          `INSERT INTO "OperationsCommand"
            (id,"requestId","idempotencyKey","sourceText","studentId","studentName",kind,"effectiveMonth",confidence,status,"holdReason","billingStatus","notificationStatus")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'HELD','HELD')`,
          commandId, requestId, command.idempotencyKey, command.sourceText, link.studentId, link.studentName,
          command.kind, command.effectiveMonth, holdReason ? "LOW" : command.confidence, holdReason ? "HELD" : "PENDING", holdReason,
        );
        for (const target of SYNC_TARGETS) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "OperationsSyncAttempt" (id,"commandId",target,status) VALUES ($1,$2,$3,'PENDING')`,
            crypto.randomUUID(), commandId, target,
          );
        }
      }
      await tx.$executeRawUnsafe(
        `INSERT INTO "OperationsAuditLog" (id,"requestId","linkId",action,"actorType","detailsJson") VALUES ($1,$2,$3,'REQUEST_SUBMITTED','PARENT_LINK',$4::jsonb)`,
        crypto.randomUUID(), requestId, link.id, JSON.stringify({ targetMonth, commandCount: commands.length }),
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_LINK_ALREADY_USED") throw new Error("이미 요청을 제출했거나 만료된 링크입니다.");
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) throw new Error("이미 같은 내용으로 접수된 요청입니다.");
    throw error;
  }
  revalidatePath("/admin/operations-sync");
  return { ok: true as const, requestId, status: "DRAFT" as const };
}

export async function revokeParentOperationsRequestLink(linkId: string) {
  const admin = await requireAdmin();
  await ensureOperationsSyncInfrastructure();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`UPDATE "ParentOperationsRequestLink" SET "revokedAt"=now(),"updatedAt"=now() WHERE id=$1 AND "revokedAt" IS NULL`, linkId);
    await tx.$executeRawUnsafe(
      `INSERT INTO "OperationsAuditLog" (id,"linkId",action,"actorType","actorUserId") VALUES ($1,$2,'LINK_REVOKED','ADMIN',$3)`,
      crypto.randomUUID(), linkId, admin.appUserId,
    );
  });
  return { ok: true as const };
}
