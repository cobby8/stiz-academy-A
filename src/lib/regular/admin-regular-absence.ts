import { prisma } from "@/lib/prisma";
import { REASON_LABEL, DAY_KO, ymdToDayIndex } from "@/lib/regular/regularAbsenceRules";

// 정규 수업 사전 결석 — 관리자 조회(#3 Step B).
// requireAdmin 게이트는 호출부(서버 액션/페이지)에서 건다. 여기는 순수 조회만.

const STATUS_LABEL: Record<string, string> = {
  REPORTED: "신고됨",
  CONFIRMED: "확정",
  CANCELLED: "취소",
};

export type RegularAbsenceRow = {
  id: string;
  studentName: string;
  className: string;
  date: string; // YYYY-MM-DD
  dateLabel: string;
  startTime: string;
  reason: string;
  reasonLabel: string;
  status: string;
  statusLabel: string;
  reportedAtLabel: string | null;
};

export type RegularAbsenceClassOption = { classId: string; className: string };

function dateLabel(ymd: string): string {
  const idx = ymdToDayIndex(ymd);
  const mm = Number(ymd.slice(5, 7));
  const dd = Number(ymd.slice(8, 10));
  const ko = idx == null ? "" : DAY_KO[idx];
  return `${mm}/${dd}(${ko})`;
}

function reportedAtLabel(value: Date | string | null): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  const f = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.month)}/${Number(p.day)} ${p.hour}:${p.minute}`;
}

// 결석 신고 목록 조회. 날짜/반 필터(옵션). CANCELLED 는 제외.
export async function getRegularAbsences(filter?: {
  date?: string;
  classId?: string;
}): Promise<RegularAbsenceRow[]> {
  const clauses: string[] = [`ra.status <> 'CANCELLED'`];
  const params: any[] = [];
  if (filter?.date) {
    params.push(filter.date);
    clauses.push(`ra.date = $${params.length}::date`);
  }
  if (filter?.classId) {
    params.push(filter.classId);
    clauses.push(`ra."classId" = $${params.length}`);
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ra.id AS id,
            s.name AS "studentName",
            c.name AS "className",
            to_char(ra.date, 'YYYY-MM-DD') AS "date",
            c."startTime" AS "startTime",
            ra.reason AS reason,
            ra.status AS status,
            ra."createdAt" AS "createdAt"
       FROM "RegularAbsence" ra
       JOIN "Student" s ON s.id = ra."studentId"
       JOIN "Class" c ON c.id = ra."classId"
      WHERE ${clauses.join(" AND ")}
      ORDER BY ra.date ASC, s.name ASC`,
    ...params,
  );

  return rows.map((r) => ({
    id: r.id,
    studentName: r.studentName,
    className: r.className,
    date: r.date,
    dateLabel: dateLabel(r.date),
    startTime: r.startTime,
    reason: r.reason,
    reasonLabel: REASON_LABEL[r.reason] || r.reason,
    status: r.status,
    statusLabel: STATUS_LABEL[r.status] || r.status,
    reportedAtLabel: reportedAtLabel(r.createdAt),
  }));
}

// 반 필터 드롭다운용 — 결석 신고가 있는 반 목록(중복 제거).
export async function getRegularAbsenceClasses(): Promise<RegularAbsenceClassOption[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT c.id AS "classId", c.name AS "className"
       FROM "RegularAbsence" ra
       JOIN "Class" c ON c.id = ra."classId"
      WHERE ra.status <> 'CANCELLED'
      ORDER BY c.name ASC`,
  );
  return rows.map((r) => ({ classId: r.classId, className: r.className }));
}
