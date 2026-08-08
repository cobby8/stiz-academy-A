import { prisma } from "@/lib/prisma";
import { calcExpiry, makeSourceKey } from "./credit-rules";

// 보강권 발급·회수 — 출결이 바뀔 때 호출된다.
//
// 설계 원칙 두 가지:
//   ① **출결 저장을 절대 방해하지 않는다.**
//      보강권 발급이 실패해도 출결은 저장돼야 한다. 선생님이 수업 중에 쓰는 화면인데
//      부수 기능 때문에 출결이 안 찍히면 더 큰 문제다. 그래서 호출부에서 try/catch 로
//      격리하고, 여기서도 예외를 삼키지 않고 던져 로그에 남긴다.
//   ② **한 결석에 한 장.** sourceKey 유니크 인덱스가 최종 방어선이고,
//      코드에서는 ON CONFLICT 로 조용히 넘어간다(출결을 여러 번 눌러도 안전).

/** KST 기준 YYYY-MM-DD. 결석일은 날짜 단위로 다룬다. */
function kstYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
}

/** YYYY-MM-DD → 그 날 KST 자정의 UTC 시각. 만료 계산 기준점을 날짜로 고정한다. */
function ymdToUtc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+09:00`);
}

export type IssueResult = { issued: boolean; creditId?: string; reason?: string };

/**
 * 결석 → 보강권 발급. 이미 있으면 아무것도 하지 않는다(멱등).
 *
 * @param absenceYmd 결석일(YYYY-MM-DD, KST). **만료는 이 날짜 기준**으로 계산된다.
 */
export async function issueMakeupCredit(input: {
  studentId: string;
  sourceType: "REGULAR" | "SEASONAL";
  sourceKey: string;
  absenceYmd: string;
  originClassId?: string | null;
  originItemId?: string | null;
  originSessionId?: string | null;
  note?: string | null;
}): Promise<IssueResult> {
  const absenceAt = ymdToUtc(input.absenceYmd);
  const expiresAt = calcExpiry(absenceAt);

  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "MakeupCredit"
       ("studentId","sourceType","sourceKey","absenceDate","expiresAt",
        "originClassId","originItemId","originSessionId","status","note")
     VALUES ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6,$7,$8,'AVAILABLE',$9)
     ON CONFLICT ("studentId","sourceKey") DO NOTHING
     RETURNING id`,
    input.studentId, input.sourceType, input.sourceKey,
    absenceAt.toISOString(), expiresAt.toISOString(),
    input.originClassId ?? null, input.originItemId ?? null, input.originSessionId ?? null,
    input.note ?? null,
  );

  if (rows[0]) return { issued: true, creditId: rows[0].id };
  return { issued: false, reason: "이미 발급된 결석입니다." };
}

/**
 * 결석이 취소되어(출석·지각으로 정정) 보강권을 거둬들인다.
 *
 * ⚠️ **아직 안 쓴 것만** 회수한다. 이미 보강을 다녀왔거나(USED) 예약 후 불참(NO_SHOW)한 건은
 *    건드리지 않는다 — 이미 자리를 썼는데 권리를 없애면 학원이 손해를 떠안는 꼴이고,
 *    반대로 되살리면 학부모가 두 번 쓰게 된다.
 *    예약 중(RESERVED)인 것도 회수하지 않는다. 예약을 먼저 취소해야 한다.
 */
export async function revokeMakeupCredit(input: {
  studentId: string;
  sourceKey: string;
  note?: string | null;
}): Promise<{ revoked: number }> {
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "MakeupCredit"
        SET "status" = 'REVOKED',
            "note" = COALESCE($3, "note"),
            "updatedAt" = now()
      WHERE "studentId" = $1 AND "sourceKey" = $2
        AND "status" = 'AVAILABLE'`,
    input.studentId, input.sourceKey, input.note ?? null,
  );
  return { revoked: Number(n) };
}

/**
 * 출결 상태에 따라 보강권을 맞춰 준다. 출결 저장 직후에 호출한다.
 *
 * ABSENT → 발급 / 그 외(PRESENT·LATE) → 회수.
 * 지각(LATE)은 결석이 아니므로 보강권을 주지 않는다(약관: "결석으로 수업의 결손").
 */
export async function syncMakeupCreditForAttendance(input: {
  studentId: string;
  status: string;
  sourceType: "REGULAR" | "SEASONAL";
  sourceKey: string;
  absenceYmd: string;
  originClassId?: string | null;
  originItemId?: string | null;
  originSessionId?: string | null;
}): Promise<{ action: "issued" | "revoked" | "none" }> {
  if (input.status === "ABSENT") {
    const r = await issueMakeupCredit(input);
    return { action: r.issued ? "issued" : "none" };
  }
  const r = await revokeMakeupCredit({
    studentId: input.studentId,
    sourceKey: input.sourceKey,
    note: `출결이 ${input.status} 로 정정되어 회수`,
  });
  return { action: r.revoked > 0 ? "revoked" : "none" };
}

/** 정규 수업 출결용 — 세션에서 반·날짜를 읽어 키를 만든다. */
export async function syncCreditForRegularSession(input: {
  sessionId: string;
  studentId: string;
  status: string;
}): Promise<{ action: string }> {
  const rows = await prisma.$queryRawUnsafe<{ classId: string; startsAt: Date | string }[]>(
    `SELECT "classId", "startsAt" FROM "Session" WHERE id = $1 LIMIT 1`,
    input.sessionId,
  );
  const row = rows[0];
  if (!row) return { action: "none" };

  const absenceYmd = kstYmd(row.startsAt instanceof Date ? row.startsAt : new Date(row.startsAt));
  return syncMakeupCreditForAttendance({
    studentId: input.studentId,
    status: input.status,
    sourceType: "REGULAR",
    sourceKey: makeSourceKey({ sourceType: "REGULAR", classId: row.classId, absenceYmd }),
    absenceYmd,
    originClassId: row.classId,
    originSessionId: input.sessionId,
  });
}

/** 방학특강 좌석 출결용 — 좌석에서 날짜·수강항목을 읽어 키를 만든다. */
export async function syncCreditForSeasonalSeat(input: {
  enrollmentDateId: string;
  studentId: string;
  status: string;
}): Promise<{ action: string }> {
  const rows = await prisma.$queryRawUnsafe<{ itemId: string; startsAt: Date | string }[]>(
    `SELECT e."applicationItemId" AS "itemId", sd."startsAt"
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramSessionDate" sd ON sd.id = e."sessionDateId"
      WHERE e.id = $1 LIMIT 1`,
    input.enrollmentDateId,
  );
  const row = rows[0];
  if (!row) return { action: "none" };

  const absenceYmd = kstYmd(row.startsAt instanceof Date ? row.startsAt : new Date(row.startsAt));
  return syncMakeupCreditForAttendance({
    studentId: input.studentId,
    status: input.status,
    sourceType: "SEASONAL",
    // 좌석 id 자체가 "그 학생의 그 날 수업"을 유일하게 가리킨다.
    sourceKey: makeSourceKey({ sourceType: "SEASONAL", enrollmentDateId: input.enrollmentDateId }),
    absenceYmd,
    originItemId: row.itemId,
    originSessionId: input.enrollmentDateId,
  });
}
