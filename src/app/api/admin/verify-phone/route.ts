import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { sendAuthenticationSms } from "@/lib/message-dispatch";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const PROOF_EXPIRY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

type VerificationRow = {
  id: string;
  otpHash: string | null;
  otpExpiresAt: Date | null;
  attempts: number;
  lockedAt: Date | null;
  lastSentAt: Date | null;
};

function secret(): string {
  const value =
    process.env.STAFF_PHONE_VERIFICATION_SECRET?.trim() ||
    process.env.SOLAPI_API_SECRET?.trim();
  if (!value) throw new Error("STAFF_PHONE_VERIFICATION_SECRET is not configured.");
  return value;
}

function hmac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function secureEqual(expected: string, actual: string): boolean {
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(actual, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizePhone(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function validPhone(phone: string): boolean {
  return /^01\d{8,9}$/.test(phone);
}

function authError() {
  return NextResponse.json({ error: "원장 로그인이 필요합니다." }, { status: 401 });
}

export async function POST(req: NextRequest) {
  let owner: Awaited<ReturnType<typeof requireOwner>>;
  try {
    owner = await requireOwner();
  } catch {
    return authError();
  }

  try {
    const phone = normalizePhone((await req.json())?.phone);
    if (!validPhone(phone)) {
      return NextResponse.json(
        { error: "올바른 휴대전화번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    const phoneHash = hmac(`phone:${phone}`);
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const otpHash = hmac(`otp:${owner.id}:${phoneHash}:${code}`);
    const sendId = randomUUID();
    const reservation = await prisma.$transaction(async (tx) => {
      // 같은 원장 또는 번호의 동시 요청을 한 줄로 세워 쿼터 우회를 막는다.
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        `staff-phone-owner:${owner.id}`,
      );
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        `staff-phone-number:${phoneHash}`,
      );

      const rows = await tx.$queryRawUnsafe<VerificationRow[]>(
        `SELECT id, "otpHash", "otpExpiresAt", attempts, "lockedAt", "lastSentAt"
           FROM "StaffPhoneVerification"
          WHERE "ownerId" = $1 AND "phoneHash" = $2
          FOR UPDATE`,
        owner.id,
        phoneHash,
      );
      const current = rows[0];
      const now = Date.now();
      if (current?.lockedAt && now - current.lockedAt.getTime() < LOCK_MS) {
        throw new Error("LOCKED");
      }
      if (current?.lastSentAt && now - current.lastSentAt.getTime() < 60_000) {
        throw new Error("COOLDOWN");
      }

      const [counts] = await tx.$queryRawUnsafe<
        Array<{ phoneHour: bigint; phoneDay: bigint; ownerHour: bigint; ownerDay: bigint }>
      >(
        `SELECT
           COUNT(*) FILTER (WHERE "phoneHash" = $1 AND "createdAt" > NOW() - INTERVAL '1 hour') AS "phoneHour",
           COUNT(*) FILTER (WHERE "phoneHash" = $1 AND "createdAt" > NOW() - INTERVAL '1 day') AS "phoneDay",
           COUNT(*) FILTER (WHERE "ownerId" = $2 AND "createdAt" > NOW() - INTERVAL '1 hour') AS "ownerHour",
           COUNT(*) FILTER (WHERE "ownerId" = $2 AND "createdAt" > NOW() - INTERVAL '1 day') AS "ownerDay"
         FROM "StaffPhoneVerificationSend"`,
        phoneHash,
        owner.id,
      );
      if (
        Number(counts.phoneHour) >= 5 ||
        Number(counts.phoneDay) >= 10 ||
        Number(counts.ownerHour) >= 20 ||
        Number(counts.ownerDay) >= 50
      ) {
        throw new Error("QUOTA");
      }

      // 중단된 외부 발송 예약은 다음 요청 때 실패로 닫아 장부가 영원히 대기하지 않게 한다.
      await tx.$executeRawUnsafe(
        `UPDATE "StaffPhoneVerificationSend"
            SET status = 'FAILED'
          WHERE "ownerId" = $1 AND status = 'RESERVED'
            AND "createdAt" < NOW() - INTERVAL '10 minutes'`,
        owner.id,
      );
      const [verification] = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO "StaffPhoneVerification"
           (id, "ownerId", "phoneHash", "currentSendId", status, "lastSentAt", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'PENDING', NOW(), NOW(), NOW())
         ON CONFLICT ("ownerId", "phoneHash") DO UPDATE
           SET "currentSendId" = $3, status = 'PENDING',
               "proofHash" = NULL, "proofExpiresAt" = NULL,
               "consumedAt" = NULL, "lastSentAt" = NOW(), "updatedAt" = NOW()
         RETURNING id`,
        owner.id,
        phoneHash,
        sendId,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "StaffPhoneVerificationSend"
           (id, "verificationId", "ownerId", "phoneHash", status, "createdAt")
         VALUES ($1, $2, $3, $4, 'RESERVED', NOW())`,
        sendId,
        verification.id,
        owner.id,
        phoneHash,
      );
      return { verificationId: verification.id, sendId };
    });

    let sent = false;
    try {
      sent = await sendAuthenticationSms(
        phone,
        `[STIZ 농구교실] 스태프 인증번호: ${code} (5분 내 입력)`,
      );
    } catch (error) {
      console.error("[verify-phone POST sms]", error);
    }

    if (!sent) {
      let failedCurrent = false;
      try {
        failedCurrent = await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
            `staff-phone-number:${phoneHash}`,
          );
          const sendUpdated = await tx.$executeRawUnsafe(
            `UPDATE "StaffPhoneVerificationSend"
                SET status = 'FAILED'
              WHERE id = $1 AND status = 'RESERVED'`,
            reservation.sendId,
          );
          if (sendUpdated !== 1) return false;
          const verificationUpdated = await tx.$executeRawUnsafe(
            `UPDATE "StaffPhoneVerification"
                SET status = 'FAILED', "otpHash" = NULL, "otpExpiresAt" = NULL,
                    "updatedAt" = NOW()
              WHERE id = $1 AND "currentSendId" = $2 AND status = 'PENDING'`,
            reservation.verificationId,
            reservation.sendId,
          );
          // 현재 세대가 아니면 Send 변경까지 함께 롤백한다.
          if (verificationUpdated !== 1) throw new Error("STALE_RESERVATION");
          return true;
        });
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "STALE_RESERVATION") throw error;
        await prisma.$executeRawUnsafe(
          `UPDATE "StaffPhoneVerificationSend"
              SET status = 'FAILED'
            WHERE id = $1 AND status = 'RESERVED'`,
          reservation.sendId,
        );
      }
      if (!failedCurrent) {
        console.warn("[verify-phone POST] stale failed reservation ignored");
      }
      return NextResponse.json(
        { error: "인증번호 문자 발송에 실패했습니다." },
        { status: 502 },
      );
    }

    let finalized = false;
    try {
      finalized = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
          `staff-phone-number:${phoneHash}`,
        );
        // 발송 장부를 먼저 확보해야 인증만 활성화되는 불일치가 생기지 않는다.
        const sendUpdated = await tx.$executeRawUnsafe(
          `UPDATE "StaffPhoneVerificationSend"
              SET status = 'SENT'
            WHERE id = $1 AND status = 'RESERVED'`,
          reservation.sendId,
        );
        if (sendUpdated !== 1) return false;
        const verificationUpdated = await tx.$executeRawUnsafe(
          `UPDATE "StaffPhoneVerification"
              SET status = 'SENT', "otpHash" = $1,
                  "otpExpiresAt" = NOW() + INTERVAL '5 minutes',
                  attempts = 0, "lastSentAt" = NOW(), "updatedAt" = NOW()
            WHERE id = $2 AND "currentSendId" = $3 AND status = 'PENDING'`,
          otpHash,
          reservation.verificationId,
          reservation.sendId,
        );
        // 최신 인증 행 갱신 실패 시 앞의 SENT 변경도 반드시 롤백한다.
        if (verificationUpdated !== 1) throw new Error("STALE_RESERVATION");
        return true;
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "STALE_RESERVATION") throw error;
      await prisma.$executeRawUnsafe(
        `UPDATE "StaffPhoneVerificationSend"
            SET status = 'FAILED'
          WHERE id = $1 AND status = 'RESERVED'`,
        reservation.sendId,
      );
    }
    if (!finalized) {
      return NextResponse.json(
        { error: "더 최근 인증 요청이 있어 현재 발송 결과를 사용할 수 없습니다." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, sent: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "LOCKED") {
      return NextResponse.json(
        { error: "인증번호 입력 횟수를 초과했습니다. 15분 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }
    if (reason === "COOLDOWN") {
      return NextResponse.json(
        { error: "인증번호는 60초 후 다시 요청할 수 있습니다." },
        { status: 429 },
      );
    }
    if (reason === "QUOTA") {
      return NextResponse.json(
        { error: "인증번호 발송 한도를 초과했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }
    console.error("[verify-phone POST]", error);
    return NextResponse.json({ error: "인증번호 발송에 실패했습니다." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let owner: Awaited<ReturnType<typeof requireOwner>>;
  try {
    owner = await requireOwner();
  } catch {
    return authError();
  }

  try {
    const body = await req.json();
    const phone = normalizePhone(body?.phone);
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!validPhone(phone) || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "전화번호와 6자리 인증번호를 확인해 주세요." },
        { status: 400 },
      );
    }

    const phoneHash = hmac(`phone:${phone}`);
    const candidateHash = hmac(`otp:${owner.id}:${phoneHash}:${code}`);
    const proof = randomBytes(32).toString("base64url");
    const proofHash = hmac(`proof:${proof}`);
    const verificationResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        `staff-phone-number:${phoneHash}`,
      );
      const [row] = await tx.$queryRawUnsafe<VerificationRow[]>(
        `SELECT id, "otpHash", "otpExpiresAt", attempts, "lockedAt", "lastSentAt"
           FROM "StaffPhoneVerification"
          WHERE "ownerId" = $1 AND "phoneHash" = $2
          FOR UPDATE`,
        owner.id,
        phoneHash,
      );
      if (!row?.otpHash || !row.otpExpiresAt) return "MISSING" as const;
      if (row.lockedAt && Date.now() - row.lockedAt.getTime() < LOCK_MS) {
        return "LOCKED" as const;
      }
      if (row.otpExpiresAt.getTime() < Date.now()) return "EXPIRED" as const;
      if (!secureEqual(row.otpHash, candidateHash)) {
        const attempts = row.attempts + 1;
        await tx.$executeRawUnsafe(
          `UPDATE "StaffPhoneVerification"
              SET attempts = $1, "lockedAt" = CASE WHEN $1 >= $2 THEN NOW() ELSE "lockedAt" END,
                  "updatedAt" = NOW()
            WHERE id = $3`,
          attempts,
          MAX_ATTEMPTS,
          row.id,
        );
        return attempts >= MAX_ATTEMPTS ? "LOCKED" as const : "MISMATCH" as const;
      }
      await tx.$executeRawUnsafe(
        `UPDATE "StaffPhoneVerification"
            SET status = 'VERIFIED', "otpHash" = NULL, "otpExpiresAt" = NULL,
                "proofHash" = $1, "proofExpiresAt" = NOW() + INTERVAL '10 minutes',
                "consumedAt" = NULL, "updatedAt" = NOW()
          WHERE id = $2`,
        proofHash,
        row.id,
      );
      return "VERIFIED" as const;
    });

    if (verificationResult !== "VERIFIED") {
      const messages: Record<string, [string, number]> = {
        MISSING: ["인증번호를 먼저 요청해 주세요.", 400],
        EXPIRED: ["인증번호가 만료되었습니다. 다시 요청해 주세요.", 400],
        MISMATCH: ["인증번호가 일치하지 않습니다.", 400],
        LOCKED: ["인증번호 입력 횟수를 초과했습니다. 15분 후 다시 시도해 주세요.", 429],
      };
      const known = messages[verificationResult];
      return NextResponse.json({ error: known[0] }, { status: known[1] });
    }
    return NextResponse.json({
      ok: true,
      verified: true,
      proof,
      proofExpiresInMs: PROOF_EXPIRY_MS,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    const messages: Record<string, [string, number]> = {
      MISSING: ["인증번호를 먼저 요청해 주세요.", 400],
      EXPIRED: ["인증번호가 만료되었습니다. 다시 요청해 주세요.", 400],
      MISMATCH: ["인증번호가 일치하지 않습니다.", 400],
      LOCKED: ["인증번호 입력 횟수를 초과했습니다. 15분 후 다시 시도해 주세요.", 429],
    };
    const known = messages[reason];
    if (known) return NextResponse.json({ error: known[0] }, { status: known[1] });
    console.error("[verify-phone PUT]", error);
    return NextResponse.json({ error: "인증번호 확인에 실패했습니다." }, { status: 500 });
  }
}
