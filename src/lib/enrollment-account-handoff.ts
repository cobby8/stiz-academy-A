import "server-only";

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const HANDOFF_TTL_HOURS = 2;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,200}$/;

function secret() {
  const value = process.env.ENROLLMENT_HANDOFF_SECRET
    || process.env.PARENT_SIGNUP_SECRET
    || process.env.PARENT_ACCOUNT_CLAIM_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("수강신청 계정 연결 보안키가 설정되지 않았습니다.");
  }
  return "development-only-enrollment-handoff-secret";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function keyed(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function normalizeEnrollmentPhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function issueEnrollmentAccountHandoff(
  enrollmentApplicationId: string,
  externalTx?: Prisma.TransactionClient,
) {
  const db = externalTx ?? prisma;
  const rows = await db.$queryRawUnsafe<Array<{ id: string; parentPhone: string }>>(
    `SELECT id, "parentPhone" FROM "EnrollmentApplication" WHERE id = $1 LIMIT 1`,
    enrollmentApplicationId,
  );
  const application = rows[0];
  const phone = normalizeEnrollmentPhone(application?.parentPhone);
  if (!application || phone.length < 10 || phone.length > 11) {
    throw new Error("수강신청 보호자 연락처를 확인해 주세요.");
  }

  const token = randomBytes(32).toString("base64url");
  await db.$executeRawUnsafe(
    `INSERT INTO "EnrollmentAccountHandoff"
      (id, "enrollmentApplicationId", "tokenHash", "phoneHash", "expiresAt", "createdAt")
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${HANDOFF_TTL_HOURS} hours', NOW())`,
    randomUUID(),
    application.id,
    sha256(token),
    keyed(`phone:${phone}`),
  );
  return token;
}

export function enrollmentSignupPath(token: string) {
  return `/signup/parent?enrollmentHandoff=${encodeURIComponent(token)}`;
}

export async function linkEnrollmentAccount(
  input: { token: string; parentUserId: string },
  externalTx?: Prisma.TransactionClient,
) {
  if (!TOKEN_PATTERN.test(input.token)) {
    throw new Error("수강신청 연결 정보가 올바르지 않습니다.");
  }
  const run = async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRawUnsafe<Array<{
      id: string;
      enrollmentApplicationId: string;
      phoneHash: string;
      expiresAt: Date;
      consumedAt: Date | null;
      parentPhone: string;
      linkedParentUserId: string | null;
      userPhone: string | null;
      phoneVerifiedAt: Date | null;
      role: string;
    }>>(
      `SELECT h.id, h."enrollmentApplicationId", h."phoneHash", h."expiresAt", h."consumedAt",
              app."parentPhone", app."parentUserId" AS "linkedParentUserId",
              u.phone AS "userPhone", u."phoneVerifiedAt", u.role::text AS role
         FROM "EnrollmentAccountHandoff" h
         JOIN "EnrollmentApplication" app ON app.id = h."enrollmentApplicationId"
         JOIN "User" u ON u.id = $2
        WHERE h."tokenHash" = $1
        FOR UPDATE OF h, app`,
      sha256(input.token),
      input.parentUserId,
    );
    const row = rows[0];
    if (!row || row.expiresAt <= new Date()) throw new Error("수강신청 연결 시간이 만료되었습니다.");
    if (row.role !== "PARENT" || !row.phoneVerifiedAt) {
      throw new Error("휴대전화 인증을 완료한 학부모 계정만 연결할 수 있습니다.");
    }
    const userPhone = normalizeEnrollmentPhone(row.userPhone);
    const applicationPhone = normalizeEnrollmentPhone(row.parentPhone);
    if (!safeEqual(row.phoneHash, keyed(`phone:${userPhone}`))
        || userPhone !== applicationPhone) {
      throw new Error("회원가입 휴대전화와 수강신청 보호자 연락처가 일치하지 않습니다.");
    }
    if (row.linkedParentUserId && row.linkedParentUserId !== input.parentUserId) {
      throw new Error("이미 다른 학부모 계정과 연결된 수강신청입니다.");
    }
    await tx.$executeRawUnsafe(
      `UPDATE "EnrollmentApplication"
          SET "parentUserId" = $2, "updatedAt" = NOW()
        WHERE id = $1 AND ("parentUserId" IS NULL OR "parentUserId" = $2)`,
      row.enrollmentApplicationId,
      input.parentUserId,
    );
    await tx.$executeRawUnsafe(
      `UPDATE "EnrollmentAccountHandoff" SET "consumedAt" = COALESCE("consumedAt", NOW()) WHERE id = $1`,
      row.id,
    );
    return { ok: true as const, enrollmentApplicationId: row.enrollmentApplicationId };
  };
  return externalTx ? run(externalTx) : prisma.$transaction(run);
}
