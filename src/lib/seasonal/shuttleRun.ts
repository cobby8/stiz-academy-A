import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

// 기사님 전용 링크(토큰) + 탑승/미탑승 기록. PgBouncer 때문에 $queryRawUnsafe 고정.

function normDate(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function normDir(v: unknown): "PICKUP" | "DROPOFF" | null {
  return v === "PICKUP" || v === "DROPOFF" ? v : null;
}

export type BoardingStatus = "BOARDED" | "NOSHOW";

// 날짜 단위 링크는 방향을 'ALL'로 저장한다(그 날 등원·하원 전체를 한 링크로).
const ALL_DIRECTION = "ALL";
// 고정(rolling) 링크: 특정 날짜가 아니라 '오늘'을 보는 링크. serviceDate에 이 값을 넣는다.
const ROLLING_DATE = "ROLLING";

/** 기사 고정 링크(매일 오늘 운행) 토큰을 만들거나 이미 있으면 그대로 돌려준다(원장 전용). */
export async function createOrGetRollingRunLink(): Promise<{ token: string }> {
  const admin = await requireAdmin();
  const token = randomBytes(16).toString("hex");
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `INSERT INTO "ShuttleRunLink" ("token","serviceDate","direction","createdByUserId")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("serviceDate","direction") DO UPDATE SET "createdAt" = "ShuttleRunLink"."createdAt"
     RETURNING "token"`,
    token, ROLLING_DATE, ALL_DIRECTION, admin.appUserId ?? null,
  );
  return { token: String(rows[0]?.token ?? token) };
}

/** 그 날짜의 기사님 링크 토큰을 만들거나 이미 있으면 그대로 돌려준다(원장 전용). 등원·하원 전체 포함. */
export async function createOrGetRunLink(date: string): Promise<{ token: string }> {
  const admin = await requireAdmin();
  const d = normDate(date);
  if (!d) throw new Error("날짜가 올바르지 않습니다.");
  const token = randomBytes(16).toString("hex"); // 32자 랜덤(추측 불가)
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `INSERT INTO "ShuttleRunLink" ("token","serviceDate","direction","createdByUserId")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("serviceDate","direction") DO UPDATE SET "createdAt" = "ShuttleRunLink"."createdAt"
     RETURNING "token"`,
    token, d, ALL_DIRECTION, admin.appUserId ?? null,
  );
  return { token: String(rows[0]?.token ?? token) };
}

/** 토큰 → 날짜(+방향, 대개 'ALL'). 없으면 null. 인증하지 않는다(토큰 자체가 열쇠). */
export async function resolveRunToken(token: string): Promise<{ date: string; direction: string } | null> {
  const t = typeof token === "string" ? token.trim() : "";
  if (!/^[a-f0-9]{16,64}$/.test(t)) return null;
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT "serviceDate", "direction" FROM "ShuttleRunLink" WHERE "token" = $1 LIMIT 1`, t,
    );
    const r = rows[0];
    const raw = typeof r?.serviceDate === "string" ? r.serviceDate : "";
    const date = raw === ROLLING_DATE ? ROLLING_DATE : normDate(raw); // 고정 링크는 'ROLLING'(오늘)로 해석
    const dir = typeof r?.direction === "string" ? r.direction : null;
    return date && dir ? { date, direction: dir } : null;
  } catch { return null; }
}

/** 그 날 탑승 상태 맵(shuttleRequestId → 상태). 인증 없음(기사님 화면이 읽는다). */
export async function getBoardingMap(date: string, direction: string): Promise<Record<string, BoardingStatus>> {
  const d = normDate(date), dir = normDir(direction);
  if (!d || !dir) return {};
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT "shuttleRequestId", "status" FROM "ShuttleBoarding" WHERE "serviceDate" = $1 AND "direction" = $2`, d, dir,
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

/** 탑승 상태 저장. status가 없으면(대기) 행을 지운다. 인증 없음 — 호출부가 유효 토큰을 먼저 확인한다. */
export async function setBoarding(input: {
  date: string; direction: string; shuttleRequestId: string;
  status: BoardingStatus | null; studentName?: string | null; via?: string;
}): Promise<{ ok: boolean }> {
  const d = normDate(input.date), dir = normDir(input.direction);
  const reqId = typeof input.shuttleRequestId === "string" ? input.shuttleRequestId.trim() : "";
  if (!d || !dir || !reqId) throw new Error("요청 형식이 올바르지 않습니다.");
  if (input.status == null) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ShuttleBoarding" WHERE "serviceDate" = $1 AND "direction" = $2 AND "shuttleRequestId" = $3`,
      d, dir, reqId,
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
    d, dir, reqId, input.studentName ?? null, status, input.via ?? "driver",
  );
  return { ok: true };
}
