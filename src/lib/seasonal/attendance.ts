import { prisma } from "@/lib/prisma";

// 방학특강 출석 라이브러리 — 모든 쿼리는 PgBouncer 트랜잭션 모드 호환을 위해 $queryRawUnsafe 사용.
// 출석은 학생(Student) 전환 여부와 무관하게 SpecialProgramEnrollmentDate 행에 직접 기록한다.

export const SEASONAL_ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;
export type SeasonalAttendanceStatus = (typeof SEASONAL_ATTENDANCE_STATUSES)[number];
const VALID_ATTENDANCE = new Set<string>(SEASONAL_ATTENDANCE_STATUSES);

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function seoulParts(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    dateLabel: `${Number(parts.month)}/${Number(parts.day)}`,
    dayLabel: (parts.weekday || "").replace("요일", ""),
    timeLabel: `${parts.hour}:${parts.minute}`,
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function num(v: unknown) { return v == null ? 0 : Number(v); }

// 1) 화면 부트스트랩: 시즌 + 특강(offering) 목록
export async function getSeasonalAttendanceBootstrap() {
  const seasons = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, title, status, "startsAt", "endsAt"
       FROM "SpecialProgramSeason"
      ORDER BY "startsAt" DESC`,
  );
  const offerings = await prisma.$queryRawUnsafe<any[]>(
    `SELECT o.id, o."seasonId", o.title, o.capacity, o."targetGrades", o."instructorName", o."linkedClassId",
            (SELECT COUNT(*) FROM "SpecialProgramSessionDate" sd WHERE sd."offeringId" = o.id) AS "dateCount",
            (SELECT COUNT(*) FROM "SpecialProgramEnrollmentDate" e
               JOIN "SpecialProgramSessionDate" sd2 ON sd2.id = e."sessionDateId"
              WHERE sd2."offeringId" = o.id AND e.status = 'SCHEDULED' AND e.kind = 'REGULAR') AS "enrolledSlots"
       FROM "SpecialProgramOffering" o
      WHERE o.status IN ('OPEN','CLOSED')
      ORDER BY o."displayOrder" ASC, o."createdAt" ASC`,
  );
  return {
    seasons: seasons.map((s) => ({ id: s.id, title: s.title, status: s.status, startsAt: s.startsAt, endsAt: s.endsAt })),
    offerings: offerings.map((o) => ({
      id: o.id, seasonId: o.seasonId, title: o.title,
      capacity: o.capacity == null ? null : Number(o.capacity),
      targetGrades: o.targetGrades ?? null, instructorName: o.instructorName ?? null,
      linkedClassId: o.linkedClassId ?? null,
      dateCount: num(o.dateCount), enrolledSlots: num(o.enrolledSlots),
    })),
  };
}

// 2) 특강 회차(날짜)별 보드 — 정원/출결 요약
export async function getOfferingDateBoard(offeringId: string) {
  const offeringRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, title, capacity, "instructorName" FROM "SpecialProgramOffering" WHERE id = $1 LIMIT 1`,
    offeringId,
  );
  const offering = offeringRows[0];
  if (!offering) return { offering: null, dates: [] };
  const capacity = offering.capacity == null ? null : Number(offering.capacity);

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT sd.id, sd."startsAt", sd."endsAt", sd.location,
            COUNT(e.id) FILTER (WHERE e.status = 'SCHEDULED') AS scheduled,
            COUNT(e.id) FILTER (WHERE e.status = 'SCHEDULED' AND e.kind = 'MAKEUP') AS makeup,
            COUNT(e.id) FILTER (WHERE e."attendanceStatus" = 'PRESENT') AS present,
            COUNT(e.id) FILTER (WHERE e."attendanceStatus" = 'LATE') AS late,
            COUNT(e.id) FILTER (WHERE e."attendanceStatus" = 'ABSENT') AS absent,
            COUNT(e.id) FILTER (WHERE e."attendanceStatus" = 'EXCUSED') AS excused,
            COUNT(e.id) FILTER (WHERE e.status = 'SCHEDULED' AND e."attendanceStatus" IS NULL) AS unchecked
       FROM "SpecialProgramSessionDate" sd
       LEFT JOIN "SpecialProgramEnrollmentDate" e ON e."sessionDateId" = sd.id AND e.status <> 'CANCELLED'
      WHERE sd."offeringId" = $1
      GROUP BY sd.id, sd."startsAt", sd."endsAt", sd.location
      ORDER BY sd."startsAt" ASC`,
    offeringId,
  );

  const todayYmd = seoulParts(new Date()).ymd;
  const dates = rows.map((r, idx) => {
    const p = seoulParts(r.startsAt);
    const end = seoulParts(r.endsAt);
    const scheduled = num(r.scheduled);
    const checked = num(r.present) + num(r.late) + num(r.absent) + num(r.excused);
    let state: "DONE" | "LIVE" | "PLANNED";
    if (p.ymd < todayYmd) state = "DONE";
    else if (p.ymd === todayYmd) state = "LIVE";
    else state = "PLANNED";
    return {
      sessionDateId: r.id, round: idx + 1,
      dateLabel: p.dateLabel, dayLabel: p.dayLabel, startTime: p.timeLabel, endTime: end.timeLabel,
      ymd: p.ymd, location: r.location ?? null,
      capacity, scheduled, makeup: num(r.makeup),
      present: num(r.present), late: num(r.late), absent: num(r.absent), excused: num(r.excused),
      unchecked: num(r.unchecked), checked, state,
    };
  });
  return {
    offering: { id: offering.id, title: offering.title, capacity, instructorName: offering.instructorName ?? null },
    dates,
  };
}

// 3) 특정 날짜(회차) 명단
export async function getDateRoster(sessionDateId: string) {
  const info = await prisma.$queryRawUnsafe<any[]>(
    `SELECT sd.id, sd."startsAt", sd."endsAt", sd.location, o.id AS "offeringId", o.title AS "offeringTitle",
            o.capacity, o."instructorName"
       FROM "SpecialProgramSessionDate" sd
       JOIN "SpecialProgramOffering" o ON o.id = sd."offeringId"
      WHERE sd.id = $1 LIMIT 1`,
    sessionDateId,
  );
  const meta = info[0];
  if (!meta) return { date: null, rows: [] };

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT e.id AS "enrollmentDateId", e.kind, e.status, e."attendanceStatus", e."arrivedAt", e."attendanceNote",
            it.id AS "itemId", a."childName", a."childGrade", a."childSchool", a."parentName", a."parentPhone",
            mk."absentSessionDateId", absd."startsAt" AS "originStartsAt"
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
       JOIN "SpecialProgramApplication" a ON a.id = it."applicationId"
       LEFT JOIN "SpecialProgramMakeup" mk ON mk.id = e."makeupId"
       LEFT JOIN "SpecialProgramSessionDate" absd ON absd.id = mk."absentSessionDateId"
      WHERE e."sessionDateId" = $1 AND e.status <> 'CANCELLED'
      ORDER BY (e.kind = 'MAKEUP') ASC, a."childName" ASC`,
    sessionDateId,
  );

  const p = seoulParts(meta.startsAt);
  const end = seoulParts(meta.endsAt);
  return {
    date: {
      sessionDateId: meta.id, offeringId: meta.offeringId, offeringTitle: meta.offeringTitle,
      dateLabel: p.dateLabel, dayLabel: p.dayLabel, startTime: p.timeLabel, endTime: end.timeLabel,
      location: meta.location ?? null, capacity: meta.capacity == null ? null : Number(meta.capacity),
      instructorName: meta.instructorName ?? null,
    },
    rows: rows.map((r) => ({
      enrollmentDateId: r.enrollmentDateId, kind: r.kind, enrollmentStatus: r.status,
      attendanceStatus: r.attendanceStatus ?? null, arrivedAt: r.arrivedAt ?? null, attendanceNote: r.attendanceNote ?? null,
      itemId: r.itemId, childName: r.childName, childGrade: r.childGrade ?? null, childSchool: r.childSchool ?? null,
      parentName: r.parentName, parentPhone: r.parentPhone,
      originAbsence: r.absentSessionDateId ? seoulParts(r.originStartsAt).dateLabel : null,
    })),
  };
}

// 4) 출결 기록/변경
export async function setSeasonalAttendance(
  enrollmentDateId: string,
  status: string | null,
  opts: { note?: string | null; arrivedAt?: string | null; userId?: string | null } = {},
) {
  if (status !== null && !VALID_ATTENDANCE.has(status)) {
    throw new Error("INVALID_ATTENDANCE_STATUS");
  }
  const arrived = status === "LATE" && opts.arrivedAt ? new Date(opts.arrivedAt) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE "SpecialProgramEnrollmentDate"
        SET "attendanceStatus" = $2,
            "attendanceNote" = $3,
            "arrivedAt" = $4,
            "attendanceCheckedAt" = CASE WHEN $2 IS NULL THEN NULL ELSE now() END,
            "attendanceCheckedByUserId" = $5,
            "updatedAt" = now()
      WHERE id = $1`,
    enrollmentDateId, status, opts.note ?? null, arrived, opts.userId ?? null,
  );
  return { ok: true };
}

export { gradeToNumber } from "@/lib/seasonal/makeup";

// 5) 선생님(스태프) — 특정 날짜(기본 오늘)의 특강 회차 목록. INSTRUCTOR는 본인 담당만.
export async function getSeasonalDatesForStaff(userId: string, role: string, ymd?: string | null) {
  const targetYmd = ymd || seoulParts(new Date()).ymd;
  const scopeInstructor = role === "INSTRUCTOR";
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT sd.id, sd."startsAt", sd."endsAt", o.title AS "offeringTitle", o.capacity, o."instructorName",
            COUNT(e.id) FILTER (WHERE e.status = 'SCHEDULED') AS scheduled,
            COUNT(e.id) FILTER (WHERE e.status = 'SCHEDULED' AND e."attendanceStatus" IS NULL) AS unchecked
       FROM "SpecialProgramSessionDate" sd
       JOIN "SpecialProgramOffering" o ON o.id = sd."offeringId"
       LEFT JOIN "SpecialProgramEnrollmentDate" e ON e."sessionDateId" = sd.id AND e.status <> 'CANCELLED'
      WHERE (sd."startsAt" AT TIME ZONE 'Asia/Seoul')::date = $1::date
        AND ($2 = false OR o."instructorId" = $3)
      GROUP BY sd.id, sd."startsAt", sd."endsAt", o.title, o.capacity, o."instructorName"
      ORDER BY sd."startsAt" ASC`,
    targetYmd, scopeInstructor, userId,
  );
  return {
    ymd: targetYmd,
    dates: rows.map((r) => {
      const p = seoulParts(r.startsAt); const end = seoulParts(r.endsAt);
      return {
        sessionDateId: r.id, offeringTitle: r.offeringTitle,
        dateLabel: p.dateLabel, dayLabel: p.dayLabel, startTime: p.timeLabel, endTime: end.timeLabel,
        capacity: r.capacity == null ? null : Number(r.capacity),
        instructorName: r.instructorName ?? null,
        scheduled: num(r.scheduled), unchecked: num(r.unchecked),
      };
    }),
  };
}
