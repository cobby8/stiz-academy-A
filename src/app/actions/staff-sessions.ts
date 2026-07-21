"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffClassAccess, requireStaffSeasonalSessionAccess } from "@/lib/staff-class-access";
import { deliverParentNotification, getClassParentRecipients } from "@/lib/staff-notifications";
import type { ParentRecipient } from "@/lib/staff-notifications";

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT";

async function requireSessionAccess(sessionId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; classId: string; status: string; className: string; sessionDateId: string | null }>>(
    `SELECT s.id, s."classId", s.status, c.name AS "className", s."specialProgramSessionDateId" AS "sessionDateId"
     FROM "Session" s JOIN "Class" c ON c.id = s."classId" WHERE s.id = $1 LIMIT 1`,
    sessionId,
  );
  if (!rows[0]) throw new Error("수업 기록을 찾을 수 없습니다.");
  const access = rows[0].sessionDateId
    ? (await requireStaffSeasonalSessionAccess(rows[0].sessionDateId)).access
    : await requireStaffClassAccess(rows[0].classId);
  return { session: rows[0], access };
}

async function isSessionRosterStudent(classId: string, sessionDateId: string | null, studentId: string) {
  if (!sessionDateId) {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "Enrollment" WHERE "classId" = $1 AND "studentId" = $2 AND status = 'ACTIVE' LIMIT 1`, classId, studentId,
    );
    return Boolean(rows[0]);
  }
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT app.id FROM "SpecialProgramApplicationItem" i
     JOIN "SpecialProgramApplication" app ON app.id = i."applicationId"
     JOIN "SpecialProgramSessionDate" sd ON sd."offeringId" = i."offeringId"
     WHERE sd.id = $1 AND app."convertedStudentId" = $2
       AND i.status = 'APPROVED'
       AND i."conversionStatus" IN ('COMPLETED', 'INVOICE_RETRY_REQUIRED')
       AND (
         COALESCE(cardinality(app."selectedWeekdays"), 0) = 0
         OR CASE EXTRACT(ISODOW FROM sd."startsAt" AT TIME ZONE 'Asia/Seoul')::int
           WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE' WHEN 3 THEN 'WED' WHEN 4 THEN 'THU'
           WHEN 5 THEN 'FRI' WHEN 6 THEN 'SAT' ELSE 'SUN'
         END = ANY(app."selectedWeekdays")
       )
     LIMIT 1`,
    sessionDateId, studentId,
  );
  return Boolean(rows[0]);
}

async function getSessionParentRecipients(session: { classId: string; sessionDateId: string | null }, studentIds?: string[]) {
  if (!session.sessionDateId) return getClassParentRecipients(session.classId, studentIds);
  return prisma.$queryRawUnsafe<ParentRecipient[]>(
    `SELECT DISTINCT st.id AS "studentId", st.name AS "studentName", st."parentId" AS "userId"
     FROM "SpecialProgramSessionDate" sd
     JOIN "SpecialProgramApplicationItem" i ON i."offeringId" = sd."offeringId"
       AND i.status = 'APPROVED'
       AND i."conversionStatus" IN ('COMPLETED', 'INVOICE_RETRY_REQUIRED')
     JOIN "SpecialProgramApplication" app ON app.id = i."applicationId"
       AND (
         COALESCE(cardinality(app."selectedWeekdays"), 0) = 0
         OR CASE EXTRACT(ISODOW FROM sd."startsAt" AT TIME ZONE 'Asia/Seoul')::int
           WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE' WHEN 3 THEN 'WED' WHEN 4 THEN 'THU'
           WHEN 5 THEN 'FRI' WHEN 6 THEN 'SAT' ELSE 'SUN'
         END = ANY(app."selectedWeekdays")
       )
     JOIN "Student" st ON st.id = app."convertedStudentId"
     WHERE sd.id = $1 AND ($2::text[] IS NULL OR st.id = ANY($2::text[])) AND st."parentId" IS NOT NULL`,
    session.sessionDateId, studentIds?.length ? studentIds : null,
  );
}

export async function savePlannedClassContent(input: {
  classId: string;
  date: string;
  plannedContent: string;
  sessionDateId?: string;
}) {
  const sessionDateId = input.sessionDateId?.trim() || null;
  const seasonal = sessionDateId ? await requireStaffSeasonalSessionAccess(sessionDateId) : null;
  const access = seasonal?.access ?? await requireStaffClassAccess(input.classId);
  if (seasonal && seasonal.seasonal.linkedClassId !== input.classId) {
    return { ok: false as const, message: "특강과 연결된 수업 정보가 일치하지 않습니다." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false as const, message: "수업 날짜를 다시 확인해 주세요." };
  }

  const sessionKey = sessionDateId ? `seasonal:${sessionDateId}` : `${input.classId}:${input.date}`;
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Session" (
       id, "classId", date, "sessionKey", status, "plannedContent", "coachId", "specialProgramSessionDateId", "createdAt", "updatedAt"
     ) VALUES (
       gen_random_uuid()::text, $1, $2::date, $3, 'PLANNED', $4, $5, $6, NOW(), NOW()
     )
     ON CONFLICT ("sessionKey") DO UPDATE SET
       "plannedContent" = EXCLUDED."plannedContent",
       "updatedAt" = NOW()
     WHERE "Session".status = 'PLANNED'
     RETURNING id`,
    input.classId,
    input.date,
    sessionKey,
    input.plannedContent.trim() || null,
    access.coachId,
    sessionDateId,
  );

  if (!rows[0]) {
    return { ok: false as const, message: "진행 중이거나 종료된 수업의 예정 내용은 여기서 바꿀 수 없습니다." };
  }

  revalidatePath("/staff");
  return { ok: true as const, sessionId: rows[0].id };
}

export async function saveSessionMemo(input: { sessionId: string; notes: string }) {
  const { session } = await requireSessionAccess(input.sessionId);
  if (session.status !== "IN_PROGRESS") {
    return { ok: false as const, message: "진행 중인 수업에서만 메모할 수 있습니다." };
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "Session" SET notes = $2, "updatedAt" = NOW() WHERE id = $1`,
    input.sessionId,
    input.notes.trim() || null,
  );
  revalidatePath(`/staff/sessions/${input.sessionId}`);
  return { ok: true as const };
}

export async function saveStaffAttendance(input: { sessionId: string; studentId: string; status: AttendanceStatus; note?: string }) {
  const { session, access } = await requireSessionAccess(input.sessionId);
  if (session.status !== "IN_PROGRESS") return { ok: false as const, message: "진행 중인 수업에서만 출결을 기록할 수 있습니다." };
  if (!["PRESENT", "LATE", "ABSENT"].includes(input.status)) return { ok: false as const, message: "올바른 출결 상태가 아닙니다." };

  const enrolled = await isSessionRosterStudent(session.classId, session.sessionDateId, input.studentId);
  if (!enrolled) return { ok: false as const, message: "이 수업의 확정 명단에 없는 학생입니다." };

  const previous = await prisma.$queryRawUnsafe<{ status: string }[]>(
    `SELECT status FROM "Attendance" WHERE "sessionId" = $1 AND "studentId" = $2 LIMIT 1`, input.sessionId, input.studentId,
  );
  const changed = previous[0]?.status !== input.status;
  const saved = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Attendance" (id, "sessionId", "studentId", status, note, "checkedAt", "arrivedAt", "checkedByUserId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), CASE WHEN $3 = 'LATE' THEN NOW() ELSE NULL END, $5, NOW(), NOW())
     ON CONFLICT ("sessionId", "studentId") DO UPDATE SET
       status = EXCLUDED.status, note = EXCLUDED.note,
       "checkedAt" = COALESCE("Attendance"."checkedAt", NOW()),
       "arrivedAt" = CASE WHEN EXCLUDED.status = 'LATE' THEN COALESCE("Attendance"."arrivedAt", NOW()) ELSE NULL END,
       "checkedByUserId" = EXCLUDED."checkedByUserId", "updatedAt" = NOW()
     RETURNING id`,
    input.sessionId, input.studentId, input.status, input.note?.trim() || null, access.staff.appUserId,
  );

  if (changed && (input.status === "PRESENT" || input.status === "LATE")) {
    try {
      const [recipient] = await getSessionParentRecipients(session, [input.studentId]);
      if (recipient) {
        const delivery = await deliverParentNotification({
          eventType: input.status === "LATE" ? "ATTENDANCE_LATE" : "ATTENDANCE_PRESENT",
          dedupeKey: `attendance:${saved[0].id}:status:${input.status}:user:${recipient.userId}`,
          recipient,
          title: `${session.className} 출석 안내`,
          message: `${recipient.studentName} 학생이 ${input.status === "LATE" ? "지각 출석" : "출석"}했습니다.`,
          linkUrl: "/parent/attendance",
          sessionId: input.sessionId,
          attendanceId: saved[0].id,
        });
        if (!delivery.duplicate && delivery.push?.status === "FAILED") {
          return { ok: true as const, attendanceId: saved[0].id, changed, notificationWarning: true as const };
        }
      }
    } catch (error) {
      console.error("[saveStaffAttendance] Parent notification failed", {
        sessionId: input.sessionId,
        studentId: input.studentId,
        error,
      });
      return { ok: true as const, attendanceId: saved[0].id, changed, notificationWarning: true as const };
    }
  }
  return { ok: true as const, attendanceId: saved[0].id, changed };
}

export async function completeClassSession(input: { sessionId: string }) {
  const { session, access } = await requireSessionAccess(input.sessionId);
  if (session.status === "COMPLETED") return { ok: true as const, completed: true, resumed: true };
  if (session.status !== "IN_PROGRESS") return { ok: false as const, message: "시작한 수업만 종료할 수 있습니다." };

  const missing = session.sessionDateId
    ? await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(DISTINCT app."convertedStudentId")::bigint AS count
         FROM "SpecialProgramSessionDate" sd
         JOIN "SpecialProgramApplicationItem" i ON i."offeringId" = sd."offeringId"
           AND i.status = 'APPROVED'
           AND i."conversionStatus" IN ('COMPLETED', 'INVOICE_RETRY_REQUIRED')
         JOIN "SpecialProgramApplication" app ON app.id = i."applicationId"
         WHERE sd.id = $1 AND app."convertedStudentId" IS NOT NULL
           AND (
             COALESCE(cardinality(app."selectedWeekdays"), 0) = 0
             OR CASE EXTRACT(ISODOW FROM sd."startsAt" AT TIME ZONE 'Asia/Seoul')::int
               WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE' WHEN 3 THEN 'WED' WHEN 4 THEN 'THU'
               WHEN 5 THEN 'FRI' WHEN 6 THEN 'SAT' ELSE 'SUN'
             END = ANY(app."selectedWeekdays")
           )
           AND NOT EXISTS (SELECT 1 FROM "Attendance" a WHERE a."sessionId" = $2 AND a."studentId" = app."convertedStudentId")`,
        session.sessionDateId, input.sessionId,
      )
    : await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM "Enrollment" e
         WHERE e."classId" = $1 AND e.status = 'ACTIVE'
           AND NOT EXISTS (SELECT 1 FROM "Attendance" a WHERE a."sessionId" = $2 AND a."studentId" = e."studentId")`,
        session.classId, input.sessionId,
      );
  if (Number(missing[0]?.count ?? 0) > 0) return { ok: false as const, message: "출결을 확인하지 않은 학생이 있습니다." };

  const ended = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE "Session" SET status = 'COMPLETED', "endedAt" = NOW(), "endedByUserId" = $2, "updatedAt" = NOW()
     WHERE id = $1 AND status = 'IN_PROGRESS' AND "startedAt" IS NOT NULL RETURNING id`,
    input.sessionId, access.staff.appUserId,
  );
  if (!ended[0]) return { ok: false as const, message: "수업 종료 상태를 다시 확인해 주세요." };

  // 종료 안내는 결석 여부와 관계없이 이 수업의 전체 재원생 학부모에게 보냅니다.
  // 수업 종료 저장은 학부모 알림보다 우선입니다. 알림 장애가 이미 끝난 수업을 실패로 되돌리지 않게 격리합니다.
  let notificationWarning:
    | { code: "PARENT_NOTIFICATION_FAILED"; failedCount: number }
    | undefined;
  try {
    const recipients = await getSessionParentRecipients(session);
    const results = await Promise.allSettled(recipients.map((recipient) => deliverParentNotification({
    eventType: "CLASS_COMPLETED",
    dedupeKey: `session:${input.sessionId}:completed:student:${recipient.studentId}:user:${recipient.userId}`,
    recipient,
    title: `${session.className} 수업 종료`,
    message: `${recipient.studentName} 학생의 수업이 종료되었습니다.`,
    linkUrl: "/parent/sessions",
    sessionId: input.sessionId,
    })));
    const failedCount = results.reduce((count, result) => {
      if (result.status === "rejected") return count + 1;
      if (result.value.duplicate || !result.value.push) return count;
      return count + (result.value.push.failedCount || (result.value.push.status === "FAILED" ? 1 : 0));
    }, 0);
    if (failedCount > 0) {
      notificationWarning = { code: "PARENT_NOTIFICATION_FAILED", failedCount };
      console.error("[completeClassSession] Parent notification delivery failed", {
        sessionId: input.sessionId,
        classId: session.classId,
        failedCount,
        recipientCount: recipients.length,
      });
    }
  } catch (error) {
    notificationWarning = { code: "PARENT_NOTIFICATION_FAILED", failedCount: 1 };
    console.error("[completeClassSession] Parent notification lookup failed", {
      sessionId: input.sessionId,
      classId: session.classId,
      error,
    });
  }
  return {
    ok: true as const,
    completed: true,
    resumed: false,
    ...(notificationWarning ? { notificationWarning } : {}),
  };
}

type SessionStartRow = {
  id: string;
  classId: string;
  status: string;
  startedAt: Date | string | null;
};

export type StartClassSessionResult =
  | {
      ok: true;
      sessionId: string;
      classId: string;
      status: "IN_PROGRESS";
      startedAt: string;
      resumed: boolean;
    }
  | {
      ok: false;
      code: "INVALID_INPUT" | "FORBIDDEN" | "COMPLETED" | "ACTIVE_SESSION" | "DB_NOT_READY" | "UNKNOWN";
      message: string;
      activeSessionId?: string;
    };

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function toIsoString(value: Date | string | null) {
  if (!value) throw new Error("수업 시작 시각이 기록되지 않았습니다.");
  return new Date(value).toISOString();
}

function isLifecycleSchemaMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("sessionKey") ||
    message.includes("specialProgramSessionDateId") ||
    message.includes("startedAt") ||
    message.includes("startedByUserId") ||
    message.includes('column "status"')
  );
}

/**
 * 확인 모달의 '수업 시작' 버튼이 호출하는 서버 기능입니다.
 * 휴대폰 시간이 아니라 DB의 NOW()를 기록해 모든 기기에서 같은 스톱워치 기준을 사용합니다.
 */
export async function startClassSession(input: {
  classId: string;
  date: string;
  sessionDateId?: string;
}): Promise<StartClassSessionResult> {
  const classId = input.classId?.trim();
  const date = input.date?.trim();

  if (!classId || !isValidDateKey(date)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "수업과 날짜 정보를 다시 확인해 주세요.",
    };
  }

  try {
    // 화면에서 다른 수업 ID를 보내더라도 서버에서 담당 수업인지 다시 검사합니다.
    const sessionDateId = input.sessionDateId?.trim() || null;
    const seasonal = sessionDateId ? await requireStaffSeasonalSessionAccess(sessionDateId) : null;
    const access = seasonal?.access ?? await requireStaffClassAccess(classId);
    if (seasonal) {
      if (seasonal.seasonal.linkedClassId !== classId) {
        return { ok: false, code: "INVALID_INPUT", message: "특강과 연결된 수업 정보가 일치하지 않습니다." };
      }
      const validDate = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "SpecialProgramSessionDate"
         WHERE id = $1 AND ("startsAt" AT TIME ZONE 'Asia/Seoul')::date = $2::date LIMIT 1`,
        sessionDateId, date,
      );
      if (!validDate[0]) return { ok: false, code: "INVALID_INPUT", message: "오늘 예정된 특강 회차가 아닙니다." };
    }
    const sessionKey = sessionDateId ? `seasonal:${sessionDateId}` : `${classId}:${date}`;
    const result = await prisma.$transaction(async (tx) => {
      // 교사별 잠금은 두 휴대폰에서 동시에 눌러도 한 수업만 열리게 하는 안전장치입니다.
      await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, access.staff.appUserId);

      // 같은 수업의 빠른 중복 클릭은 새 장부를 만들지 않고 기존 장부로 복귀합니다.
      const existing = await tx.$queryRawUnsafe<SessionStartRow[]>(
        `SELECT id, "classId", status, "startedAt"
         FROM "Session"
         WHERE "sessionKey" = $1
         LIMIT 1`,
        sessionKey,
      );

      if (existing[0]?.status === "IN_PROGRESS") {
        return {
          ok: true as const,
          sessionId: existing[0].id,
          classId: existing[0].classId,
          status: "IN_PROGRESS" as const,
          startedAt: toIsoString(existing[0].startedAt),
          resumed: true,
        };
      }

      if (existing[0]?.status === "COMPLETED") {
        return { ok: false as const, code: "COMPLETED" as const, message: "이미 종료된 수업입니다." };
      }

      const active = await tx.$queryRawUnsafe<SessionStartRow[]>(
        `SELECT id, "classId", status, "startedAt"
         FROM "Session"
         WHERE status = 'IN_PROGRESS'
           AND "startedByUserId" = $1
         ORDER BY "startedAt" DESC
         LIMIT 1`,
        access.staff.appUserId,
      );

      if (active[0]) {
        return {
          ok: false as const,
          code: "ACTIVE_SESSION" as const,
          message: "진행 중인 수업을 먼저 종료해 주세요.",
          activeSessionId: active[0].id,
        };
      }

      // 사전에 작성된 PLANNED Session이 있으면 시작 상태로 한 번만 변경합니다.
      const started = await tx.$queryRawUnsafe<SessionStartRow[]>(
        `UPDATE "Session"
         SET status = 'IN_PROGRESS',
             "startedAt" = COALESCE("startedAt", NOW()),
             "startedByUserId" = COALESCE("startedByUserId", $2),
             "coachId" = COALESCE("coachId", $3),
             "updatedAt" = NOW()
         WHERE "sessionKey" = $1
           AND status = 'PLANNED'
         RETURNING id, "classId", status, "startedAt"`,
        sessionKey,
        access.staff.appUserId,
        access.coachId,
      );

      if (started[0]) {
        return {
          ok: true as const,
          sessionId: started[0].id,
          classId: started[0].classId,
          status: "IN_PROGRESS" as const,
          startedAt: toIsoString(started[0].startedAt),
          resumed: false,
        };
      }

      // 첫 요청만 새 Session을 만듭니다. 같은 키의 재요청은 아무것도 생성하지 않습니다.
      const inserted = await tx.$queryRawUnsafe<SessionStartRow[]>(
      `INSERT INTO "Session" (
         id, "classId", date, "sessionKey", status, "coachId",
         "startedAt", "startedByUserId", "specialProgramSessionDateId", "createdAt", "updatedAt"
       )
       VALUES (
         gen_random_uuid()::text, $1, $2::date, $3, 'IN_PROGRESS', $4,
         NOW(), $5, $6, NOW(), NOW()
       )
       ON CONFLICT ("sessionKey") DO NOTHING
       RETURNING id, "classId", status, "startedAt"`,
      classId,
      date,
      sessionKey,
      access.coachId,
      access.staff.appUserId,
      sessionDateId,
      );

      if (inserted[0]) {
        return {
          ok: true as const,
          sessionId: inserted[0].id,
          classId: inserted[0].classId,
          status: "IN_PROGRESS" as const,
          startedAt: toIsoString(inserted[0].startedAt),
          resumed: false,
        };
      }

      return { ok: false as const, code: "UNKNOWN" as const, message: "수업을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요." };
    });

    if (result.ok) revalidatePath("/staff");
    return result;
  } catch (error) {
    if (isLifecycleSchemaMissing(error)) {
      return {
        ok: false,
        code: "DB_NOT_READY",
        message: "수업 시작 기능을 준비 중입니다. 관리자에게 문의해 주세요.",
      };
    }

    const message = error instanceof Error ? error.message : "수업 시작 권한을 확인하지 못했습니다.";
    const isPermissionError =
      message.includes("담당 특강") ||
      message.includes("담당 수업") ||
      message.includes("코치 정보") ||
      message.includes("권한") ||
      message.includes("permission");

    if (isPermissionError) {
      return { ok: false, code: "FORBIDDEN", message };
    }

    console.error("[startClassSession] failed:", error);
    return {
      ok: false,
      code: "UNKNOWN",
      message: "수업을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}
