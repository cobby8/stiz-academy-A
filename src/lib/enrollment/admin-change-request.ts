import { prisma } from "@/lib/prisma";
import { CHANGE_KIND_LABEL, type ChangeKind } from "@/lib/enrollment/changeRequestRules";

// ── 원장의 수강 변경 승인/거절 + 적용일이 된 건 반영 ────────────────────────
//
// 승인은 "예약"이다. 8월에 승인해도 실제 반 이동은 적용일(다음 달 1일)에 일어난다.
// 바로 옮기면 그달 남은 수업의 출석부와 청구가 어긋난다.

export type AdminChangeRequestRow = {
  id: string;
  studentName: string;
  kind: string;
  kindLabel: string;
  fromClassName: string | null;
  toClassName: string | null;
  effectiveFrom: string;
  resumeOn: string | null;
  reason: string | null;
  status: string;
  waitlisted: boolean;
  toClassFull: boolean;
  createdAt: string;
  appliedAt: string | null;
  decisionNote: string | null;
};

export async function getEnrollmentChangeRequests(status = "PENDING"): Promise<AdminChangeRequestRow[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    // 정원은 신청 당시가 아니라 **지금** 기준으로 다시 센다. 그 사이 자리가 났을 수 있다.
    `SELECT r.id, s.name AS "studentName", r.kind,
            fc.name AS "fromClassName", tc.name AS "toClassName",
            to_char(r."effectiveFrom",'YYYY-MM-DD') AS "effectiveFrom",
            to_char(r."resumeOn",'YYYY-MM-DD') AS "resumeOn",
            r.reason, r.status, r.waitlisted, r."decisionNote",
            to_char(r."createdAt" AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD HH24:MI') AS "createdAt",
            to_char(r."appliedAt" AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD HH24:MI') AS "appliedAt",
            CASE WHEN tc.id IS NULL THEN false ELSE
              (SELECT count(*) FROM "Enrollment" x WHERE x."classId" = tc.id AND x.status = 'ACTIVE') >= tc.capacity
            END AS "toClassFull"
       FROM "EnrollmentChangeRequest" r
       JOIN "Student" s ON s.id = r."studentId"
       LEFT JOIN "Class" fc ON fc.id = r."fromClassId"
       LEFT JOIN "Class" tc ON tc.id = r."toClassId"
      WHERE ($1 = 'ALL' OR r.status = $1)
      ORDER BY r."createdAt" DESC
      LIMIT 200`,
    status,
  );
  return rows.map((row) => ({
    id: row.id,
    studentName: row.studentName,
    kind: row.kind,
    kindLabel: CHANGE_KIND_LABEL[row.kind as ChangeKind] ?? row.kind,
    fromClassName: row.fromClassName ?? null,
    toClassName: row.toClassName ?? null,
    effectiveFrom: row.effectiveFrom,
    resumeOn: row.resumeOn ?? null,
    reason: row.reason ?? null,
    status: row.status,
    waitlisted: Boolean(row.waitlisted),
    toClassFull: Boolean(row.toClassFull),
    createdAt: row.createdAt,
    appliedAt: row.appliedAt ?? null,
    decisionNote: row.decisionNote ?? null,
  }));
}

export async function decideEnrollmentChangeRequest(input: {
  adminUserId: string;
  requestId: string;
  approve: boolean;
  note?: string | null;
}) {
  const note = (input.note ?? "").trim().slice(0, 500) || null;
  const rows = await prisma.$queryRawUnsafe<any[]>(
    // PENDING 만 결정할 수 있다. 이미 결정된 건을 다시 눌러도 두 번 반영되지 않는다.
    `UPDATE "EnrollmentChangeRequest"
        SET status = $2, "decidedByUserId" = $3, "decidedAt" = now(),
            "decisionNote" = $4, "updatedAt" = now()
      WHERE id = $1 AND status = 'PENDING'
      RETURNING id, "studentId", kind, to_char("effectiveFrom",'YYYY-MM-DD') AS "effectiveFrom"`,
    input.requestId, input.approve ? "APPROVED" : "REJECTED", input.adminUserId, note,
  );
  if (!rows[0]) return { ok: false as const, message: "이미 처리된 신청입니다." };

  await notifyParentOfDecision({
    studentId: rows[0].studentId,
    kind: rows[0].kind,
    approved: input.approve,
    effectiveFrom: rows[0].effectiveFrom,
    note,
  });

  // 적용일이 이미 지났으면(예: 늦게 승인) 바로 반영한다.
  const applied = input.approve ? await applyDueEnrollmentChanges() : 0;
  return { ok: true as const, appliedNow: applied > 0 };
}

/**
 * 적용일이 된 승인 건을 실제 수강 등록에 반영한다. 크론이 매일 부른다.
 * 이미 반영한 건(appliedAt)은 건드리지 않아 두 번 실행해도 안전하다.
 */
export async function applyDueEnrollmentChanges(): Promise<number> {
  const due = await prisma.$queryRawUnsafe<any[]>(
    `SELECT r.id, r.kind, r."enrollmentId", r."toClassId", r."studentId"
       FROM "EnrollmentChangeRequest" r
      WHERE r.status = 'APPROVED'
        AND r."appliedAt" IS NULL
        AND r."effectiveFrom" <= (now() AT TIME ZONE 'Asia/Seoul')::date
      ORDER BY r."effectiveFrom"
      LIMIT 200`,
  );

  let applied = 0;
  for (const row of due) {
    try {
      if (row.kind === "PAUSE" || row.kind === "WITHDRAW") {
        await prisma.$executeRawUnsafe(
          `UPDATE "Enrollment" SET status = $2, "updatedAt" = now() WHERE id = $1`,
          row.enrollmentId, row.kind === "PAUSE" ? "PAUSED" : "WITHDRAWN",
        );
      } else if (row.kind === "CLASS_CHANGE" && row.toClassId) {
        // 같은 학생·반 조합은 유일해야 한다(@@unique). 그 반에 예전 등록 이력이 있으면
        // 반을 바꾸는 UPDATE 가 충돌하므로, 그 행을 되살리고 지금 행을 접는 식으로 옮긴다.
        const existing = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id FROM "Enrollment" WHERE "studentId" = $1 AND "classId" = $2 LIMIT 1`,
          row.studentId, row.toClassId,
        );
        if (existing[0]) {
          await prisma.$executeRawUnsafe(
            `UPDATE "Enrollment" SET status = 'ACTIVE', "updatedAt" = now() WHERE id = $1`,
            existing[0].id,
          );
          await prisma.$executeRawUnsafe(
            `UPDATE "Enrollment" SET status = 'WITHDRAWN', "updatedAt" = now() WHERE id = $1`,
            row.enrollmentId,
          );
        } else {
          await prisma.$executeRawUnsafe(
            `UPDATE "Enrollment" SET "classId" = $2, "updatedAt" = now() WHERE id = $1`,
            row.enrollmentId, row.toClassId,
          );
        }
      }
      await prisma.$executeRawUnsafe(
        `UPDATE "EnrollmentChangeRequest" SET "appliedAt" = now(), "updatedAt" = now() WHERE id = $1`,
        row.id,
      );
      applied += 1;
    } catch (error) {
      // 한 건이 실패해도 나머지는 반영한다. 실패 건은 appliedAt 이 비어 있어 다음 날 다시 시도된다.
      console.error("[applyDueEnrollmentChanges] 반영 실패:", row.id, error);
    }
  }
  return applied;
}

async function notifyParentOfDecision(input: {
  studentId: string;
  kind: string;
  approved: boolean;
  effectiveFrom: string;
  note: string | null;
}) {
  try {
    const { notifyParentsOfStudents } = await import("@/lib/notification");
    const label = CHANGE_KIND_LABEL[input.kind as ChangeKind] ?? "수강 변경";
    const title = input.approved ? `${label} 승인` : `${label} 신청 결과`;
    const message = input.approved
      ? `${label} 신청이 승인되었습니다. ${input.effectiveFrom}부터 적용됩니다.`
      : `${label} 신청이 반려되었습니다.${input.note ? ` (${input.note})` : " 학원으로 문의해 주세요."}`;
    await notifyParentsOfStudents([input.studentId], "ENROLLMENT_CHANGE", title, message, "/mypage/enrollment-change");
  } catch (error) {
    // 알림 실패가 승인을 되돌리면 안 된다. 원장은 이미 결정했다.
    console.error("[admin-change-request] 학부모 알림 실패:", error);
  }
}
