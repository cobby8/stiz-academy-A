import { Prisma } from "@prisma/client";
import { SeasonalError } from "@/lib/seasonal/contracts";

export type SpecialSessionDateInput = {
  id?: string | null;
  startsAt: Date;
  endsAt: Date;
  location?: string | null;
  note?: string | null;
};

function koreaDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function sessionDateForKorea(value: Date) {
  return new Date(`${koreaDateKey(value)}T00:00:00.000Z`);
}

function changed(left: Date, right: Date) {
  return left.getTime() !== right.getTime();
}

async function findOperationalSession(
  tx: Prisma.TransactionClient,
  input: { linkedClassId: string; instructorId: string | null },
  sessionDate: { id: string; startsAt: Date; endsAt: Date },
) {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string; status: string; attendanceCount: number }>>(
    `SELECT s.id, s.status, COUNT(att.id)::int AS "attendanceCount"
       FROM "Session" s
       JOIN "SpecialProgramSessionDate" sd ON sd.id = s."specialProgramSessionDateId"
       JOIN "SpecialProgramOffering" o ON o.id = sd."offeringId"
       JOIN "SpecialProgramSessionDate" current_sd ON current_sd.id = $4
       JOIN "SpecialProgramOffering" current_o ON current_o.id = current_sd."offeringId"
       LEFT JOIN "Attendance" att ON att."sessionId" = s.id
      WHERE s."classId" = $1
        AND sd."startsAt" = $2
        AND sd."endsAt" = $3
        AND sd.id <> $4
        AND o."linkedClassId" = $1
        AND o."seasonId" = current_o."seasonId"
      GROUP BY s.id
      ORDER BY CASE WHEN s.status <> 'PLANNED' THEN 0 ELSE 1 END, s.id
      LIMIT 1`,
    input.linkedClassId,
    sessionDate.startsAt,
    sessionDate.endsAt,
    sessionDate.id,
  );
  const existing = rows[0];
  if (existing && existing.status === "PLANNED" && existing.attendanceCount === 0) {
    await tx.session.update({ where: { id: existing.id }, data: { coachId: input.instructorId } });
  }
  return existing ?? null;
}

export async function syncOfferingSessionDates(
  tx: Prisma.TransactionClient,
  input: { offeringId: string; linkedClassId: string | null; instructorId: string | null; dates: SpecialSessionDateInput[] },
) {
  const existing = await tx.specialProgramSessionDate.findMany({
    where: { offeringId: input.offeringId },
    include: { session: { include: { _count: { select: { attendances: true } } } } },
  });
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const suppliedIds = new Set(input.dates.map((row) => row.id).filter((id): id is string => Boolean(id)));

  for (const row of input.dates) {
    if (row.id && !existingById.has(row.id)) throw new SeasonalError("다른 특강의 수업 회차를 수정할 수 없습니다.", 409, "SESSION_DATE_MISMATCH");
  }

  for (const row of existing.filter((item) => !suppliedIds.has(item.id))) {
    if (row.session && (row.session.status !== "PLANNED" || row.session._count.attendances > 0)) {
      throw new SeasonalError("출석이 시작되었거나 완료된 특강 회차는 삭제할 수 없습니다.", 409, "SESSION_DATE_LOCKED");
    }
    if (row.session) await tx.session.delete({ where: { id: row.session.id } });
    await tx.specialProgramSessionDate.delete({ where: { id: row.id } });
  }

  const saved = [];
  for (const row of input.dates) {
    const previous = row.id ? existingById.get(row.id) : null;
    const coreChanged = Boolean(previous && (changed(previous.startsAt, row.startsAt) || changed(previous.endsAt, row.endsAt)));
    if (coreChanged && previous?.session && (previous.session.status !== "PLANNED" || previous.session._count.attendances > 0)) {
      throw new SeasonalError("출석이 시작되었거나 완료된 특강 회차의 시간은 변경할 수 없습니다.", 409, "SESSION_DATE_LOCKED");
    }
    const sessionDate = previous
      ? await tx.specialProgramSessionDate.update({ where: { id: previous.id }, data: { startsAt: row.startsAt, endsAt: row.endsAt, location: row.location, note: row.note } })
      : await tx.specialProgramSessionDate.create({ data: { offeringId: input.offeringId, startsAt: row.startsAt, endsAt: row.endsAt, location: row.location, note: row.note } });
    saved.push(sessionDate);

    if (input.linkedClassId) {
      const existingSession = previous?.session;
      const operationalSession = await findOperationalSession(tx, { linkedClassId: input.linkedClassId, instructorId: input.instructorId }, sessionDate);
      if (operationalSession) {
        if (existingSession && existingSession.id !== operationalSession.id) {
          if (existingSession.status !== "PLANNED" || existingSession._count.attendances > 0) {
            throw new SeasonalError("같은 운영반·시간에 이미 출석이 시작된 특강 회차가 있습니다.", 409, "SESSION_DATE_LOCKED");
          }
          await tx.session.delete({ where: { id: existingSession.id } });
        }
        continue;
      }
      if (existingSession && (existingSession.status !== "PLANNED" || existingSession._count.attendances > 0)) {
        if (existingSession.classId !== input.linkedClassId || existingSession.coachId !== input.instructorId) {
          throw new SeasonalError("출석이 시작된 특강 회차의 연결 반이나 강사를 변경할 수 없습니다.", 409, "SESSION_DATE_LOCKED");
        }
      } else {
        await tx.session.upsert({
          where: { specialProgramSessionDateId: sessionDate.id },
          create: { classId: input.linkedClassId, date: sessionDateForKorea(sessionDate.startsAt), sessionKey: `seasonal:${sessionDate.id}`, status: "PLANNED", coachId: input.instructorId, specialProgramSessionDateId: sessionDate.id },
          update: { classId: input.linkedClassId, date: sessionDateForKorea(sessionDate.startsAt), sessionKey: `seasonal:${sessionDate.id}`, coachId: input.instructorId },
        });
      }
    } else if (previous?.session) {
      if (previous.session.status !== "PLANNED" || previous.session._count.attendances > 0) throw new SeasonalError("출석이 시작된 특강 회차의 연결 반을 해제할 수 없습니다.", 409, "SESSION_DATE_LOCKED");
      await tx.session.delete({ where: { id: previous.session.id } });
    }
  }
  return saved;
}
