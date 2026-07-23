import "server-only";

import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendAuthenticationSms } from "@/lib/message-dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const TERMS_VERSION = "2026-07-23";
const PRIVACY_VERSION = "2026-07-23";
const USERNAME_PATTERN = /^[a-z][a-z0-9_]{3,19}$/;
export type ParentSignupMethod = "PASSWORD" | "GOOGLE" | "KAKAO" | "NAVER";

type Row = {
  id: string; username: string | null; name: string | null; phone: string; phoneHash: string;
  signupMethod: ParentSignupMethod; email: string | null; pendingAuthUserId: string | null;
  status: string; expiresAt: Date; otpHash: string | null; otpExpiresAt: Date | null;
  otpAttempts: number; lockedAt: Date | null; proofHash: string | null; proofExpiresAt: Date | null;
};

function secret() {
  const value = process.env.PARENT_SIGNUP_SECRET || process.env.PARENT_ACCOUNT_CLAIM_SECRET || process.env.INVITE_OTP_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("회원가입 인증 보안키가 설정되지 않았습니다.");
  return "development-only-parent-signup-secret";
}
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function keyed(value: string) { return createHmac("sha256", secret()).update(value).digest("hex"); }
function equalHex(a: string, b: string) {
  const left = Buffer.from(a, "hex"); const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
export function normalizeParentUsername(value: string) { return value.trim().toLowerCase(); }
export function normalizeParentPhone(value: string) { return value.replace(/\D/g, ""); }
export function parentUsernameAuthEmail(username: string) { return `${normalizeParentUsername(username)}@member.stiz.kr`; }

async function find(token: string, tx: Prisma.TransactionClient | typeof prisma, lock = false) {
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(token)) return null;
  const rows = await tx.$queryRawUnsafe<Row[]>(
    `SELECT id, username, name, phone, "phoneHash", "signupMethod", email, "pendingAuthUserId", status,
      "expiresAt", "otpHash", "otpExpiresAt", "otpAttempts", "lockedAt", "proofHash", "proofExpiresAt"
     FROM "ParentSignupVerification" WHERE "tokenHash" = $1${lock ? " FOR UPDATE" : ""}`,
    hash(token),
  );
  return rows[0] ?? null;
}

async function rejectExisting(tx: Prisma.TransactionClient, username: string, phone: string) {
  const rows = await tx.$queryRawUnsafe<Array<{ usernameTaken: boolean; phoneTaken: boolean }>>(
    `SELECT
      EXISTS(SELECT 1 FROM "User" WHERE LOWER(COALESCE(username, '')) = LOWER($1)) AS "usernameTaken",
      EXISTS(SELECT 1 FROM "User" WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $2) AS "phoneTaken"`,
    username, phone,
  );
  if (rows[0]?.usernameTaken) throw new Error("이미 사용 중인 로그인 아이디입니다.");
  if (rows[0]?.phoneTaken) throw new Error("이미 가입된 휴대폰 번호입니다. 기존 계정으로 로그인하거나 계정 찾기를 이용해 주세요.");
}

export async function startParentSignup(input: {
  phone: string; signupMethod?: ParentSignupMethod;
  email?: string | null; pendingAuthUserId?: string | null;
}) {
  const phone = normalizeParentPhone(input.phone);
  const method = input.signupMethod ?? "PASSWORD";
  if (!/^01[016789]\d{7,8}$/.test(phone)) return { error: "올바른 휴대폰 번호를 입력해 주세요." };
  if (method !== "PASSWORD" && !input.pendingAuthUserId) return { error: "간편가입 계정을 먼저 확인해 주세요." };
  const token = randomBytes(32).toString("base64url");
  const phoneHash = keyed(`phone:${phone}`);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM "ParentSignupVerification"
          WHERE status <> 'CONSUMED' AND "createdAt" < NOW() - INTERVAL '7 days'`,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "ParentSignupVerification"
            SET username=NULL, name=NULL, phone='', email=NULL, "pendingAuthUserId"=NULL,
                "phoneHash"=repeat('0',64), "lastError"=NULL, "updatedAt"=NOW()
          WHERE status='CONSUMED' AND "createdAt" < NOW() - INTERVAL '7 days' AND phone <> ''`,
      );
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, `signup:${phoneHash}`);
      const conflicts = await tx.$queryRawUnsafe<Array<{ found: boolean }>>(
        `SELECT EXISTS(SELECT 1 FROM "User" WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1) AS found`, phone,
      );
      if (conflicts[0]?.found) throw new Error("이미 가입된 휴대폰 번호입니다. 기존 계정으로 로그인하거나 계정 찾기를 이용해 주세요.");
      const recent = await tx.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count FROM "ParentSignupVerification"
         WHERE "phoneHash" = $1 AND "createdAt" > NOW() - INTERVAL '60 seconds'`, phoneHash,
      );
      if (Number(recent[0]?.count) > 0) throw new Error("가입 인증은 60초 후 다시 요청할 수 있습니다.");
      await tx.$executeRawUnsafe(
        `UPDATE "ParentSignupVerification" SET status = 'CANCELLED', "updatedAt" = NOW()
         WHERE "phoneHash" = $1 AND status IN ('PENDING', 'VERIFIED')`, phoneHash,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "ParentSignupVerification"
         (id, "tokenHash", username, name, phone, "phoneHash", "signupMethod", email, "pendingAuthUserId", status, "expiresAt", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING',NOW()+INTERVAL '30 minutes',NOW(),NOW())`,
        randomUUID(), hash(token), null, null, phone, phoneHash, method,
        input.email?.trim().toLowerCase() || null, input.pendingAuthUserId ?? null,
      );
    });
    return { ok: true, token };
  } catch (error) { return { error: error instanceof Error ? error.message : "가입 인증을 시작하지 못했습니다." }; }
}

export async function sendParentSignupOtp(token: string, requestKey = "unknown") {
  const code = randomInt(100000, 1000000).toString();
  const requestHash = keyed(`request:${requestKey}`);
  let row: Row | null = null; let reserved: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      row = await find(token, tx, true);
      const current = row as Row | null;
      if (!current || current.status !== "PENDING" || current.expiresAt <= new Date()) throw new Error("가입 인증 요청이 만료되었습니다.");
      if (current.lockedAt && Date.now() - current.lockedAt.getTime() < 15 * 60_000) throw new Error("인증 시도가 잠겼습니다. 15분 후 다시 시도해 주세요.");
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        "parent-signup-sms-global",
      );
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        `parent-signup-sms-request:${requestHash}`,
      );
      const quota = await tx.$queryRawUnsafe<Array<{ recent: number; daily: number; hourlyRequest: number; dailyRequest: number; dailyGlobal: number }>>(
        `SELECT
         (SELECT COUNT(*) FROM "ParentSignupVerification" WHERE id=$1 AND "otpSentAt">NOW()-INTERVAL '60 seconds')::int AS recent,
         (SELECT COUNT(*) FROM "ParentSignupOtpSend" WHERE "phoneHash"=$2 AND status IN ('RESERVED','SENT') AND "createdAt">NOW()-INTERVAL '1 day')::int AS daily,
         (SELECT COUNT(*) FROM "ParentSignupOtpSend" WHERE "requestHash"=$3 AND status IN ('RESERVED','SENT') AND "createdAt">NOW()-INTERVAL '1 hour')::int AS "hourlyRequest",
         (SELECT COUNT(*) FROM "ParentSignupOtpSend" WHERE "requestHash"=$3 AND status IN ('RESERVED','SENT') AND "createdAt">NOW()-INTERVAL '1 day')::int AS "dailyRequest",
         (SELECT COUNT(*) FROM "ParentSignupOtpSend" WHERE status IN ('RESERVED','SENT') AND "createdAt">NOW()-INTERVAL '1 day')::int AS "dailyGlobal"`,
        current.id, current.phoneHash, requestHash,
      );
      if (Number(quota[0]?.recent) > 0) throw new Error("인증번호는 60초 후 다시 요청할 수 있습니다.");
      if (Number(quota[0]?.daily) >= 10) throw new Error("오늘 인증번호 요청 횟수를 초과했습니다.");
      if (Number(quota[0]?.hourlyRequest) >= 5 || Number(quota[0]?.dailyRequest) >= 20) throw new Error("인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
      if (Number(quota[0]?.dailyGlobal) >= 5000) throw new Error("현재 인증 요청이 많습니다. 잠시 후 다시 시도해 주세요.");
      reserved = keyed(`otp:${hash(token)}:${current.phone}:${code}`);
      await tx.$executeRawUnsafe(
        `INSERT INTO "ParentSignupOtpSend" (id,"verificationId","phoneHash","requestHash",status,"createdAt") VALUES ($1,$2,$3,$4,'RESERVED',NOW())`,
        randomUUID(), current.id, current.phoneHash, requestHash,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "ParentSignupVerification" SET "otpHash"=$1,"otpExpiresAt"=NOW()+INTERVAL '${OTP_TTL_MINUTES} minutes',
         "otpSentAt"=NOW(),"otpAttempts"=0,"lockedAt"=NULL,"proofHash"=NULL,"proofExpiresAt"=NULL,"updatedAt"=NOW() WHERE id=$2`,
        reserved, current.id,
      );
    });
    if (process.env.NODE_ENV !== "test" && !(await sendAuthenticationSms(row!.phone, `[STIZ 농구교실] 회원가입 인증번호: ${code} (5분 이내 입력)`))) {
      throw new Error("인증번호 문자 발송에 실패했습니다.");
    }
    await prisma.$executeRawUnsafe(`UPDATE "ParentSignupOtpSend" SET status='SENT' WHERE "verificationId"=$1 AND status='RESERVED'`, row!.id);
    return { ok: true };
  } catch (error) {
    const failedRow = row as Row | null;
    if (failedRow && reserved) await prisma.$transaction([
      prisma.$executeRawUnsafe(`UPDATE "ParentSignupOtpSend" SET status='FAILED' WHERE "verificationId"=$1 AND status='RESERVED'`, failedRow.id),
      prisma.$executeRawUnsafe(`UPDATE "ParentSignupVerification" SET "otpHash"=NULL,"otpExpiresAt"=NULL WHERE id=$1 AND "otpHash"=$2`, failedRow.id, reserved),
    ]).catch(() => undefined);
    return { error: error instanceof Error ? error.message : "인증번호를 보내지 못했습니다." };
  }
}

export async function verifyParentSignupOtp(token: string, code: string) {
  if (!/^\d{6}$/.test(code.trim())) return { error: "6자리 인증번호를 입력해 주세요." };
  return prisma.$transaction(async (tx) => {
    const row = await find(token, tx, true);
    if (!row || row.status !== "PENDING" || row.expiresAt <= new Date()) return { error: "가입 인증 요청이 만료되었습니다." };
    if (row.lockedAt && Date.now() - row.lockedAt.getTime() < 15 * 60_000) return { error: "인증 시도가 잠겼습니다. 15분 후 다시 시도해 주세요." };
    if (!row.otpHash || !row.otpExpiresAt || row.otpExpiresAt <= new Date()) return { error: "인증번호를 다시 요청해 주세요." };
    const supplied = keyed(`otp:${hash(token)}:${row.phone}:${code.trim()}`);
    if (!equalHex(row.otpHash, supplied)) {
      const attempts = Math.min(row.otpAttempts + 1, MAX_ATTEMPTS);
      await tx.$executeRawUnsafe(`UPDATE "ParentSignupVerification" SET "otpAttempts"=$1,"lockedAt"=CASE WHEN $1 >= $2 THEN NOW() ELSE NULL END WHERE id=$3`, attempts, MAX_ATTEMPTS, row.id);
      return { error: attempts >= MAX_ATTEMPTS ? "인증 시도가 잠겼습니다. 15분 후 다시 시도해 주세요." : `인증번호가 일치하지 않습니다. (${MAX_ATTEMPTS - attempts}회 남음)` };
    }
    const proof = randomBytes(32).toString("base64url");
    await tx.$executeRawUnsafe(
      `UPDATE "ParentSignupVerification" SET status='VERIFIED',"verifiedAt"=NOW(),"otpHash"=NULL,"proofHash"=$2,"proofExpiresAt"=NOW()+INTERVAL '10 minutes',"updatedAt"=NOW() WHERE id=$1`,
      row.id, keyed(`proof:${hash(token)}:${proof}`),
    );
    return { ok: true, proof };
  });
}

export async function completeParentSignup(input: {
  token: string; proof: string; username: string; name: string; password?: string;
  consents: { terms: boolean; privacy: boolean; age: boolean };
  authenticatedOAuthUser?: { id: string; email?: string | null; provider?: string | null } | null;
}) {
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(input.proof)) return { error: "휴대폰 인증이 만료되었습니다." };
  const username = normalizeParentUsername(input.username);
  const name = input.name.trim();
  if (!USERNAME_PATTERN.test(username)) return { error: "아이디는 영문 소문자로 시작하고 영문·숫자·밑줄 조합의 4~20자로 입력해 주세요." };
  if (name.length < 2 || name.length > 40) return { error: "이름은 2~40자로 입력해 주세요." };
  if (!input.consents.terms || !input.consents.privacy || !input.consents.age) return { error: "필수 약관과 만 14세 이상 확인에 모두 동의해 주세요." };
  const attemptId = randomUUID(); let row: Row | null = null; let authUserId: string | null = null; let createdAuth = false;
  try {
    row = await prisma.$transaction(async (tx) => {
      const current = await find(input.token, tx, true);
      if (!current || current.status !== "VERIFIED" || current.expiresAt <= new Date()) throw new Error("휴대폰 인증을 먼저 완료해 주세요.");
      if (!current.proofHash || !current.proofExpiresAt || current.proofExpiresAt <= new Date() || !equalHex(current.proofHash, keyed(`proof:${hash(input.token)}:${input.proof}`))) throw new Error("휴대폰 인증 증표가 없거나 만료되었습니다.");
      await rejectExisting(tx, username, current.phone);
      if (current.signupMethod === "PASSWORD" && (!input.password || input.password.length < 8)) throw new Error("비밀번호는 8자 이상 입력해 주세요.");
      if (current.signupMethod !== "PASSWORD" && input.authenticatedOAuthUser?.id !== current.pendingAuthUserId) throw new Error("간편가입 계정을 다시 확인해 주세요.");
      if (current.signupMethod !== "PASSWORD") {
        const actualMethod = input.authenticatedOAuthUser?.provider === "google"
          ? "GOOGLE"
          : input.authenticatedOAuthUser?.provider === "kakao"
            ? "KAKAO"
            : input.authenticatedOAuthUser?.provider === "custom:naver" || input.authenticatedOAuthUser?.provider === "naver"
              ? "NAVER"
              : null;
        if (actualMethod !== current.signupMethod) throw new Error("간편가입 제공자 정보가 일치하지 않습니다.");
        const linked = await tx.$queryRawUnsafe<Array<{ found: boolean }>>(
          `SELECT EXISTS(
             SELECT 1 FROM "User"
              WHERE "authUserId" = $1 OR id = $1
                 OR ($2 <> '' AND LOWER(email) = LOWER($2))
           ) AS found`,
          input.authenticatedOAuthUser!.id,
          input.authenticatedOAuthUser?.email || "",
        );
        if (linked[0]?.found) throw new Error("이미 연결된 계정입니다. 기존 계정으로 로그인해 주세요.");
      }
      const changed = await tx.$executeRawUnsafe(
        `UPDATE "ParentSignupVerification" SET status='PROCESSING', username=$2, name=$3,
         "termsAgreedAt"=NOW(), "termsVersion"=$5,
         "privacyAgreedAt"=NOW(), "privacyVersion"=$6, "ageConfirmedAt"=NOW(),
         "processingAt"=NOW(),"processingAttemptId"=$4,"updatedAt"=NOW()
         WHERE id=$1 AND status='VERIFIED'`,
        current.id, username, name, attemptId, TERMS_VERSION, PRIVACY_VERSION,
      );
      if (changed !== 1) throw new Error("회원가입이 이미 처리 중입니다.");
      return { ...current, username, name };
    });
    const admin = createAdminClient();
    if (row.signupMethod === "PASSWORD") {
      const created = await admin.auth.admin.createUser({ email: parentUsernameAuthEmail(row.username!), password: input.password!, email_confirm: true, app_metadata: { role: "PARENT" }, user_metadata: { name: row.name!, username: row.username! } });
      if (created.error || !created.data.user) throw new Error(created.error?.message?.toLowerCase().includes("already") ? "이미 사용 중인 로그인 아이디입니다." : "로그인 계정을 만들지 못했습니다.");
      authUserId = created.data.user.id; createdAuth = true;
    } else {
      authUserId = input.authenticatedOAuthUser!.id;
    }
    await prisma.$transaction(async (tx) => {
      await rejectExisting(tx, row!.username!, row!.phone);
      const email = row!.signupMethod === "PASSWORD" ? parentUsernameAuthEmail(row!.username!) : (row!.email || input.authenticatedOAuthUser?.email || parentUsernameAuthEmail(row!.username!));
      await tx.$executeRawUnsafe(
        `INSERT INTO "User" (id,email,username,name,phone,"phoneVerifiedAt","authUserId",role,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW(),$1,'PARENT'::"Role",NOW(),NOW())`,
        authUserId, email, row!.username!, row!.name!, row!.phone,
      );
      const consumed = await tx.$executeRawUnsafe(`UPDATE "ParentSignupVerification" SET status='CONSUMED',"consumedAt"=NOW(),"authUserId"=$2,"proofHash"=NULL,"proofExpiresAt"=NULL WHERE id=$1 AND status='PROCESSING' AND "processingAttemptId"=$3`, row!.id, authUserId, attemptId);
      if (consumed !== 1) throw new Error("회원가입 처리 상태가 변경되었습니다.");
    });
    return { ok: true, username: row.username };
  } catch (error) {
    if (createdAuth && authUserId) await createAdminClient().auth.admin.deleteUser(authUserId).catch(() => undefined);
    if (row) await prisma.$executeRawUnsafe(`UPDATE "ParentSignupVerification" SET status='VERIFIED',"processingAt"=NULL,"processingAttemptId"=NULL,"lastError"=$2 WHERE id=$1 AND status='PROCESSING' AND "processingAttemptId"=$3`, row.id, error instanceof Error ? error.message.slice(0, 1000) : "SIGNUP_FAILED", attemptId).catch(() => undefined);
    return { error: error instanceof Error ? error.message : "회원가입을 완료하지 못했습니다." };
  }
}
