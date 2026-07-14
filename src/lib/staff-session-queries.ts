import { prisma } from "@/lib/prisma";
import {
  getAccessibleClassIds,
  getStaffClassAccessContext,
  requireStaffClassAccess,
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

type TodayClassRow = Omit<StaffTodayClass, "startedAt"> & { startedAt: Date | string | null };
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
  if (classIds.length === 0) return [];

  const dateKey = getKoreaDateKey();
  const koreaDay = new Date(`${dateKey}T12:00:00+09:00`).getDay();
  const rows = await prisma.$queryRawUnsafe<TodayClassRow[]>(
    `SELECT c.id, c.name, c."startTime", c."endTime", c.location,
            COUNT(DISTINCT e.id)::int AS "studentCount",
            s.id AS "sessionId", s.status AS "sessionStatus",
            s."plannedContent", s."startedAt"
     FROM "Class" c
     LEFT JOIN "Enrollment" e ON e."classId" = c.id AND e.status = 'ACTIVE'
     LEFT JOIN "Session" s ON s."classId" = c.id AND s.date = $2::date
     WHERE c.id = ANY($1::text[]) AND c."dayOfWeek" = $3
     GROUP BY c.id, s.id
     ORDER BY c."startTime", c.name`,
    classIds,
    dateKey,
    DAY_KEYS[koreaDay],
  );

  return rows.map((row) => ({ ...row, startedAt: toIso(row.startedAt) }));
}

export async function getStaffSessionDetail(sessionId: string): Promise<StaffSessionDetail | null> {
  const rows = await prisma.$queryRawUnsafe<SessionDetailRow[]>(
    `SELECT s.id, s."classId", c.name AS "className", c."startTime", c."endTime",
            c.location, s.status, s."plannedContent", s.content, s.notes, s."photosJSON",
            s."startedAt", s."endedAt",
            COUNT(DISTINCT e.id)::int AS "studentCount"
     FROM "Session" s
     JOIN "Class" c ON c.id = s."classId"
     LEFT JOIN "Enrollment" e ON e."classId" = c.id AND e.status = 'ACTIVE'
     WHERE s.id = $1
     GROUP BY s.id, c.id
     LIMIT 1`,
    sessionId,
  );
  const row = rows[0];
  if (!row) return null;

  await requireStaffClassAccess(row.classId);
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
