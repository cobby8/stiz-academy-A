import { prisma } from "@/lib/prisma";
import {
  getAccessibleClassIds,
  getStaffClassAccessContext,
  requireStaffClassAccess,
  requireStaffSeasonalSessionAccess,
} from "@/lib/staff-class-access";

export type StaffTodayClass = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  location: string | null;
  studentCount: number;
  sessionId: string | null;
  sessionStatus: string | null;
  plannedContent: string | null;
  startedAt: string | null;
  kind: "REGULAR" | "SEASONAL";
  scheduleKey: string;
  sessionDateId: string | null;
};

export type StaffSessionDetail = {
  id: string;
  classId: string;
  className: string;
  startTime: string;
  endTime: string;
  location: string | null;
  studentCount: number;
  status: string;
  plannedContent: string | null;
  content: string | null;
  notes: string | null;
  photos: string[];
  startedAt: string | null;
  endedAt: string | null;
};

export type StaffSessionStudent = {
  id: string;
  name: string;
  status: "PRESENT" | "LATE" | "ABSENT" | null;
  attendanceNote: string | null;
  arrivedAt: string | null;
};

type TodayClassRow = Omit<StaffTodayClass, "startedAt" | "kind" | "scheduleKey" | "sessionDateId"> & {
  startedAt: Date | string | null;
  kind?: "REGULAR" | "SEASONAL";
  scheduleKey?: string;
  sessionDateId?: string | null;
};
type SessionDetailRow = Omit<StaffSessionDetail, "startedAt" | "endedAt"> & {
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  photosJSON: string | null;
};

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getKoreaDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toIso(value: Date | string | null) {
  return value ? new Date(value).toISOString() : null;
}

export async function getTodayStaffClasses(): Promise<StaffTodayClass[]> {
  const access = await getStaffClassAccessContext();
  const classIds = await getAccessibleClassIds(access);

  const dateKey = getKoreaDateKey();
  const koreaDay = new Date(`${dateKey}T12:00:00+09:00`).getDay();
  const regularRows = classIds.length === 0 ? [] : await prisma.$queryRawUnsafe<TodayClassRow[]>(
    `SELECT c.id, c.name, c."startTime", c."endTime", c.location,
            COUNT(DISTINCT e.id)::int AS "studentCount",
            s.id AS "sessionId", s.status AS "sessionStatus",
            s."plannedContent", s."startedAt"
     FROM "Class" c
     LEFT JOIN "Enrollment" e ON e."classId" = c.id AND e.status = 'ACTIVE'
     LEFT JOIN "Session" s ON s."classId" = c.id AND s.date = $2::date
       AND s."specialProgramSessionDateId" IS NULL
     WHERE c.id = ANY($1::text[]) AND c."dayOfWeek" = $3
     GROUP BY c.id, s.id
     ORDER BY c."startTime", c.name`,
    classIds,
    dateKey,
    DAY_KEYS[koreaDay],
  );

  const seasonalRows = await prisma.$queryRawUnsafe<TodayClassRow[]>(
    `WITH occurrence AS (
       SELECT c.id,
              c.name,
              sd."startsAt",
              sd."endsAt",
              COALESCE(MIN(sd.location), MIN(o.location), c.location) AS location,
              (ARRAY_AGG(sd.id ORDER BY CASE WHEN existing_s.id IS NULL THEN 1 ELSE 0 END, sd.id))[1] AS "sessionDateId",
              COUNT(DISTINCT a."convertedStudentId")::int AS "studentCount"
         FROM "SpecialProgramSessionDate" sd
         JOIN "SpecialProgramOffering" o ON o.id = sd."offeringId"
         JOIN "Class" c ON c.id = o."linkedClassId"
         LEFT JOIN "Session" existing_s ON existing_s."specialProgramSessionDateId" = sd.id
         LEFT JOIN "SpecialProgramApplicationItem" i
           ON i."offeringId" = o.id AND i.status = 'APPROVED'
             AND i."conversionStatus" IN ('COMPLETED', 'INVOICE_RETRY_REQUIRED')
         LEFT JOIN "SpecialProgramApplication" a
           ON a.id = i."applicationId" AND a."convertedStudentId" IS NOT NULL
            AND (
              COALESCE(cardinality(a."selectedWeekdays"), 0) = 0
              OR CASE EXTRACT(ISODOW FROM sd."startsAt" AT TIME ZONE 'Asia/Seoul')::int
                WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE' WHEN 3 THEN 'WED' WHEN 4 THEN 'THU'
                WHEN 5 THEN 'FRI' WHEN 6 THEN 'SAT' ELSE 'SUN'
              END = ANY(a."selectedWeekdays")
            )
        WHERE (sd."startsAt" AT TIME ZONE 'Asia/Seoul')::date = $1::date
          AND (
            $2::boolean = true
            OR EXISTS (
              SELECT 1
                FROM "SpecialProgramSessionDate" access_sd
                JOIN "SpecialProgramOffering" access_o ON access_o.id = access_sd."offeringId"
                LEFT JOIN "Session" access_s ON access_s."specialProgramSessionDateId" = access_sd.id
               WHERE access_sd."startsAt" = sd."startsAt"
                 AND access_sd."endsAt" = sd."endsAt"
                 AND access_o."linkedClassId" = o."linkedClassId"
                 AND access_o."seasonId" = o."seasonId"
                 AND (access_s."coachId" = $3 OR (access_s.id IS NULL AND access_o."instructorId" = $3))
            )
          )
        GROUP BY c.id, c.name, c.location, sd."startsAt", sd."endsAt"
     )
     SELECT occurrence.id,
            occurrence.name,
            to_char(occurrence."startsAt" AT TIME ZONE 'Asia/Seoul', 'HH24:MI') AS "startTime",
            to_char(occurrence."endsAt" AT TIME ZONE 'Asia/Seoul', 'HH24:MI') AS "endTime",
            occurrence.location,
            occurrence."studentCount",
            s.id AS "sessionId", s.status AS "sessionStatus",
            s."plannedContent", s."startedAt",
            'SEASONAL' AS kind,
            ('seasonal:' || occurrence."sessionDateId") AS "scheduleKey",
            occurrence."sessionDateId"
       FROM occurrence
       LEFT JOIN "Session" s ON s."specialProgramSessionDateId" = occurrence."sessionDateId"
      ORDER BY occurrence."startsAt", occurrence.name`,
    dateKey,
    access.canAccessAllClasses,
    access.coachId,
  );

  const normalizedRegular = regularRows.map((row) => ({
    ...row,
    kind: "REGULAR" as const,
    scheduleKey: `regular:${row.id}`,
    sessionDateId: null,
    startedAt: toIso(row.startedAt),
  }));
  const normalizedSeasonal = seasonalRows.map((row) => ({
    ...row,
    kind: "SEASONAL" as const,
    scheduleKey: row.scheduleKey ?? `seasonal:${row.sessionDateId}`,
    sessionDateId: row.sessionDateId ?? null,
    startedAt: toIso(row.startedAt),
  }));
  return [...normalizedRegular, ...normalizedSeasonal].sort((a, b) =>
    a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name),
  );
}

export async function getStaffSessionDetail(sessionId: string): Promise<StaffSessionDetail | null> {
  const rows = await prisma.$queryRawUnsafe<Array<SessionDetailRow & { sessionDateId: string | null }>>(
    `SELECT s.id, s."classId", COALESCE(c.name, anchor_o.title) AS "className",
            COALESCE(to_char(sd."startsAt" AT TIME ZONE 'Asia/Seoul', 'HH24:MI'), c."startTime") AS "startTime",
            COALESCE(to_char(sd."endsAt" AT TIME ZONE 'Asia/Seoul', 'HH24:MI'), c."endTime") AS "endTime",
            COALESCE(sd.location, anchor_o.location, c.location) AS location,
            s.status, s."plannedContent", s.content, s.notes, s."photosJSON",
            s."startedAt", s."endedAt",
            s."specialProgramSessionDateId" AS "sessionDateId",
            CASE WHEN sd.id IS NOT NULL
              THEN COUNT(DISTINCT app."convertedStudentId")
              ELSE COUNT(DISTINCT e.id)
            END::int AS "studentCount"
     FROM "Session" s
     JOIN "Class" c ON c.id = s."classId"
     LEFT JOIN "SpecialProgramSessionDate" sd ON sd.id = s."specialProgramSessionDateId"
     LEFT JOIN "SpecialProgramOffering" anchor_o ON anchor_o.id = sd."offeringId"
     LEFT JOIN "SpecialProgramSessionDate" matched_sd
       ON matched_sd."startsAt" = sd."startsAt" AND matched_sd."endsAt" = sd."endsAt"
     LEFT JOIN "SpecialProgramOffering" o
       ON o.id = matched_sd."offeringId"
      AND (
        o.id = anchor_o.id
        OR (
          anchor_o."linkedClassId" IS NOT NULL
          AND o."linkedClassId" = anchor_o."linkedClassId"
          AND o."seasonId" = anchor_o."seasonId"
        )
      )
     LEFT JOIN "SpecialProgramApplicationItem" i ON i."offeringId" = o.id
       AND i.status = 'APPROVED'
       AND i."conversionStatus" IN ('COMPLETED', 'INVOICE_RETRY_REQUIRED')
     LEFT JOIN "SpecialProgramApplication" app ON app.id = i."applicationId"
       AND app."convertedStudentId" IS NOT NULL
       AND (
         COALESCE(cardinality(app."selectedWeekdays"), 0) = 0
         OR CASE EXTRACT(ISODOW FROM sd."startsAt" AT TIME ZONE 'Asia/Seoul')::int
           WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE' WHEN 3 THEN 'WED' WHEN 4 THEN 'THU'
           WHEN 5 THEN 'FRI' WHEN 6 THEN 'SAT' ELSE 'SUN'
         END = ANY(app."selectedWeekdays")
       )
     LEFT JOIN "Enrollment" e ON e."classId" = c.id AND e.status = 'ACTIVE'
     WHERE s.id = $1
     GROUP BY s.id, c.id, sd.id, anchor_o.id
     LIMIT 1`,
    sessionId,
  );
  const row = rows[0];
  if (!row) return null;

  if (row.sessionDateId) await requireStaffSeasonalSessionAccess(row.sessionDateId);
  else await requireStaffClassAccess(row.classId);
  let photos: string[] = [];
  try {
    const parsed = JSON.parse(row.photosJSON || "[]");
    photos = Array.isArray(parsed)
      ? parsed.map((item) => (typeof item === "string" ? item : item?.url)).filter(Boolean)
      : [];
  } catch {
    photos = [];
  }

  return {
    ...row,
    photos,
    startedAt: toIso(row.startedAt),
    endedAt: toIso(row.endedAt),
  };
}

export async function getStaffSessionStudents(
  sessionId: string,
  classId: string,
): Promise<StaffSessionStudent[]> {
  const sessionKinds = await prisma.$queryRawUnsafe<Array<{ sessionDateId: string | null }>>(
    `SELECT "specialProgramSessionDateId" AS "sessionDateId" FROM "Session" WHERE id = $1 LIMIT 1`,
    sessionId,
  );
  const sessionDateId = sessionKinds[0]?.sessionDateId;
  if (sessionDateId) {
    await requireStaffSeasonalSessionAccess(sessionDateId);
    const rows = await prisma.$queryRawUnsafe<
      Array<Omit<StaffSessionStudent, "arrivedAt"> & { arrivedAt: Date | string | null }>
    >(
      `SELECT DISTINCT st.id, st.name, att.status, att.note AS "attendanceNote", att."arrivedAt"
       FROM "Session" s
       JOIN "SpecialProgramSessionDate" anchor_sd ON anchor_sd.id = s."specialProgramSessionDateId"
       JOIN "SpecialProgramOffering" anchor_o ON anchor_o.id = anchor_sd."offeringId"
       JOIN "SpecialProgramSessionDate" sd
         ON sd."startsAt" = anchor_sd."startsAt" AND sd."endsAt" = anchor_sd."endsAt"
       JOIN "SpecialProgramOffering" o
         ON o.id = sd."offeringId"
        AND (
          o.id = anchor_o.id
          OR (
            anchor_o."linkedClassId" IS NOT NULL
            AND o."linkedClassId" = anchor_o."linkedClassId"
            AND o."seasonId" = anchor_o."seasonId"
          )
        )
       JOIN "SpecialProgramApplicationItem" i ON i."offeringId" = o.id
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
       LEFT JOIN "Attendance" att ON att."sessionId" = s.id AND att."studentId" = st.id
       WHERE s.id = $1
       ORDER BY st.name`,
      sessionId,
    );
    return rows.map((row) => ({ ...row, arrivedAt: toIso(row.arrivedAt) }));
  }

  await requireStaffClassAccess(classId);
  const rows = await prisma.$queryRawUnsafe<
    Array<Omit<StaffSessionStudent, "arrivedAt"> & { arrivedAt: Date | string | null }>
  >(
    `SELECT st.id, st.name, a.status, a.note AS "attendanceNote", a."arrivedAt"
     FROM "Enrollment" e
     JOIN "Student" st ON st.id = e."studentId"
     LEFT JOIN "Attendance" a ON a."sessionId" = $1 AND a."studentId" = st.id
     WHERE e."classId" = $2 AND e.status = 'ACTIVE'
     ORDER BY st.name`,
    sessionId,
    classId,
  );
  return rows.map((row) => ({ ...row, arrivedAt: toIso(row.arrivedAt) }));
}
