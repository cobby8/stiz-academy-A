import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

// 정규 셔틀 기사님 링크(토큰) + 탑승/미탑승 기록. 방학특강(shuttleRun.ts)과 테이블은 공유하되,
// direction 값을 'REGULAR'로 구분해 섞이지 않게 한다. PgBouncer 때문에 $queryRawUnsafe 고정.

export type BoardingStatus = "BOARDED" | "NOSHOW";

const ROLLING_DATE = "ROLLING";   // '오늘'을 따라가는 고정 링크
const REGULAR_DIR = "REGULAR";    // 정규 셔틀 표식(방학특강의 ALL/PICKUP/DROPOFF와 구분)

function normDate(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** 정규 셔틀 기사 고정 링크(매일 오늘 운행) 토큰을 만들거나 이미 있으면 그대로 돌려준다(원장 전용). */
export async function createOrGetRegularRunLink(): Promise<{ token: string }> {
  const admin = await requireAdmin();
  const token = randomBytes(16).toString("hex");
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `INSERT INTO "ShuttleRunLink" ("token","serviceDate","direction","createdByUserId")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("serviceDate","direction") DO UPDATE SET "createdAt" = "ShuttleRunLink"."createdAt"
     RETURNING "token"`,
    token, ROLLING_DATE, REGULAR_DIR, admin.appUserId ?? null,
  );
  return { token: String(rows[0]?.token ?? token) };
}

/** 토큰이 정규 셔틀 고정 링크인지 확인한다. 맞으면 true. 인증하지 않는다(토큰이 열쇠). */
export async function isRegularRunToken(token: string): Promise<boolean> {
  const t = typeof token === "string" ? token.trim() : "";
  if (!/^[a-f0-9]{16,64}$/.test(t)) return false;
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT "direction" FROM "ShuttleRunLink" WHERE "token" = $1 LIMIT 1`, t,
    );
    return rows[0]?.direction === REGULAR_DIR;
  } catch { return false; }
}

/** 그 날 정규 셔틀 탑승 상태 맵(정차행 id → 상태). 인증 없음(기사님 화면이 읽는다). */
export async function getRegularBoardingMap(date: string): Promise<Record<string, BoardingStatus>> {
  const d = normDate(date);
  if (!d) return {};
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT "shuttleRequestId", "status" FROM "ShuttleBoarding" WHERE "serviceDate" = $1 AND "direction" = $2`,
      d, REGULAR_DIR,
    );
    const out: Record<string, BoardingStatus> = {};
    for (const r of rows) {
      const id = r.shuttleRequestId as string;
      const st = r.status === "NOSHOW" ? "NOSHOW" : r.status === "BOARDED" ? "BOARDED" : null;
      if (id && st) out[id] = st;
    }
    return out;
  } catch { return {}; }
}

/** 정규 셔틀 탑승 상태 저장. status가 없으면(대기) 행을 지운다. 인증 없음 — 호출부가 유효 토큰을 먼저 확인한다. */
export async function setRegularBoarding(input: {
  date: string; rowId: string; status: BoardingStatus | null; studentName?: string | null;
}): Promise<{ ok: boolean }> {
  const d = normDate(input.date);
  const rowId = typeof input.rowId === "string" ? input.rowId.trim() : "";
  if (!d || !rowId) throw new Error("요청 형식이 올바르지 않습니다.");
  if (input.status == null) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ShuttleBoarding" WHERE "serviceDate" = $1 AND "direction" = $2 AND "shuttleRequestId" = $3`,
      d, REGULAR_DIR, rowId,
    );
    return { ok: true };
  }
  const status = input.status === "NOSHOW" ? "NOSHOW" : "BOARDED";
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ShuttleBoarding" ("serviceDate","direction","shuttleRequestId","studentName","status","checkedVia","checkedAt")
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT ("serviceDate","direction","shuttleRequestId") DO UPDATE SET
       "status" = EXCLUDED."status", "studentName" = COALESCE(EXCLUDED."studentName", "ShuttleBoarding"."studentName"),
       "checkedVia" = EXCLUDED."checkedVia", "checkedAt" = now()`,
    d, REGULAR_DIR, rowId, input.studentName ?? null, status, "driver",
  );
  return { ok: true };
}
