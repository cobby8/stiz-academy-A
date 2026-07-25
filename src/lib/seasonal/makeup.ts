import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";

// 방학특강 보강 라이브러리. 규칙: 결석일+2개월 이내, 결석 1건당 보강 1건, 정원(특강 12/정규반 capacity) 미만.
export const MAKEUP_WINDOW_DAYS = 60;

// "2026년 초등 5학년", "초등 5학년", "5학년", "중등 2학년" → 비교 가능한 숫자(초1=1..초6=6, 중1=7..중3=9)
export function gradeToNumber(raw?: string | null): number | null {
  if (!raw) return null;
  const s = String(raw);
  const m = s.match(/(\d+)\s*학년/) || s.match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : NaN;
  if (!Number.isFinite(n)) return null;
  if (/중/.test(s)) return n + 6;
  return n;
}

const DOW_MAP: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
  일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6,
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
};
function parseDow(raw?: string | null): number | null {
  if (!raw) return null;
  const key = String(raw).trim().toUpperCase().replace("요일", "");
  const short = key.slice(0, 3);
  if (key in DOW_MAP) return DOW_MAP[key];
  if (short in DOW_MAP) return DOW_MAP[short];
  const one = String(raw).trim().charAt(0);
  if (one in DOW_MAP) return DOW_MAP[one];
  return null;
}
function num(v: unknown) { return v == null ? 0 : Number(v); }
function seoulYmd(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function seoulLabel(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  const f = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.month)}/${Number(p.day)}(${(p.weekday || "").replace("요일", "")})`;
}

// 결석 1건에 대한 보강 후보 조회
export async function getMakeupOptions(enrollmentDateId: string) {
  const absRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT e.id, e."applicationItemId", e."sessionDateId" AS "absentSessionDateId", e."attendanceStatus", e."studentId",
            it."offeringId", o.capacity, o.title AS "offeringTitle",
            a."childName", a."childGrade",
            sd."startsAt" AS "absentStartsAt"
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
       JOIN "SpecialProgramApplication" a ON a.id = it."applicationId"
       JOIN "SpecialProgramOffering" o ON o.id = it."offeringId"
       JOIN "SpecialProgramSessionDate" sd ON sd.id = e."sessionDateId"
      WHERE e.id = $1 LIMIT 1`,
    enrollmentDateId,
  );
  const abs = absRows[0];
  if (!abs) throw new Error("ABSENCE_NOT_FOUND");
  const capacity = abs.capacity == null ? 999999 : Number(abs.capacity);

  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, status, "targetType", "targetSessionDateId", "targetClassId", "targetDate"
       FROM "SpecialProgramMakeup"
      WHERE "applicationItemId" = $1 AND "absentSessionDateId" = $2 AND status NOT IN ('CANCELLED','REJECTED')
      LIMIT 1`,
    abs.applicationItemId, abs.absentSessionDateId,
  );

  // 같은 특강 다른 날짜 후보
  const seasonal = await prisma.$queryRawUnsafe<any[]>(
    `SELECT sd.id, sd."startsAt", sd."endsAt",
            COUNT(e2.id) FILTER (WHERE e2.status = 'SCHEDULED') AS filled
       FROM "SpecialProgramSessionDate" sd
       LEFT JOIN "SpecialProgramEnrollmentDate" e2 ON e2."sessionDateId" = sd.id AND e2.status <> 'CANCELLED'
      WHERE sd."offeringId" = $1
        AND sd.id <> $2
        AND sd."startsAt" > $3::timestamptz
        AND sd."startsAt" <= ($3::timestamptz + interval '60 days')
        AND NOT EXISTS (
          SELECT 1 FROM "SpecialProgramEnrollmentDate" e3
           WHERE e3."applicationItemId" = $4 AND e3."sessionDateId" = sd.id AND e3.status <> 'CANCELLED'
        )
      GROUP BY sd.id, sd."startsAt", sd."endsAt"
     HAVING COUNT(e2.id) FILTER (WHERE e2.status = 'SCHEDULED') < $5
      ORDER BY sd."startsAt" ASC`,
    abs.offeringId, abs.absentSessionDateId, abs.absentStartsAt, abs.applicationItemId, capacity,
  );

  // 정규수업(정규반) 후보 — 학년 구성 유사 순
  const classes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT c.id, c.name, c."dayOfWeek", c."startTime", c."endTime", c.capacity, u.name AS instructor,
            COUNT(en.id) FILTER (WHERE en.status = 'ACTIVE') AS enrolled,
            array_remove(array_agg(st.grade) FILTER (WHERE en.status = 'ACTIVE'), NULL) AS grades
       FROM "Class" c
       LEFT JOIN "User" u ON u.id = c."instructorId"
       LEFT JOIN "Enrollment" en ON en."classId" = c.id AND en.status = 'ACTIVE'
       LEFT JOIN "Student" st ON st.id = en."studentId"
      GROUP BY c.id, u.name`,
  );

  const childGrade = gradeToNumber(abs.childGrade);
  const absStart = new Date(abs.absentStartsAt);
  const windowEnd = new Date(absStart.getTime() + MAKEUP_WINDOW_DAYS * 86400000);
  const regular = classes
    .map((c) => {
      const grades = (c.grades || []).map((g: string) => gradeToNumber(g)).filter((x: number | null) => x != null) as number[];
      const avg = grades.length ? grades.reduce((s, x) => s + x, 0) / grades.length : null;
      const gradeDiff = childGrade != null && avg != null ? Math.abs(childGrade - avg) : null;
      const enrolled = num(c.enrolled);
      const cap = c.capacity == null ? null : Number(c.capacity);
      const dow = parseDow(c.dayOfWeek);
      let nextDate: string | null = null;
      if (dow != null) {
        const cursor = new Date(absStart.getTime() + 86400000);
        for (let i = 0; i < MAKEUP_WINDOW_DAYS; i++) {
          const ymd = seoulYmd(cursor);
          const d = new Date(ymd + "T00:00:00+09:00");
          if (d.getUTCDay() === (dow % 7)) { nextDate = ymd; break; }
          cursor.setTime(cursor.getTime() + 86400000);
          if (cursor > windowEnd) break;
        }
      }
      return {
        classId: c.id, name: c.name, instructor: c.instructor ?? null,
        dayOfWeek: c.dayOfWeek, startTime: c.startTime, endTime: c.endTime,
        capacity: cap, enrolled, hasRoom: cap == null ? true : enrolled < cap,
        gradeAvg: avg, gradeDiff, nextDate,
      };
    })
    .filter((c) => c.hasRoom && c.nextDate)
    .sort((a, b) => {
      const ga = a.gradeDiff == null ? 99 : a.gradeDiff;
      const gb = b.gradeDiff == null ? 99 : b.gradeDiff;
      if (ga !== gb) return ga - gb;
      return (a.nextDate || "").localeCompare(b.nextDate || "");
    })
    .slice(0, 6);

  return {
    absence: {
      enrollmentDateId: abs.id, applicationItemId: abs.applicationItemId, offeringId: abs.offeringId,
      offeringTitle: abs.offeringTitle, childName: abs.childName, childGrade: abs.childGrade ?? null,
      absentSessionDateId: abs.absentSessionDateId, absentLabel: seoulLabel(abs.absentStartsAt),
      isAbsent: abs.attendanceStatus === "ABSENT",
    },
    alreadyAssigned: existing[0] ?? null,
    windowEndLabel: seoulLabel(windowEnd),
    seasonalCandidates: seasonal.map((s) => ({
      sessionDateId: s.id, label: seoulLabel(s.startsAt), filled: num(s.filled),
      capacity: abs.capacity == null ? null : Number(abs.capacity),
      remaining: abs.capacity == null ? null : Number(abs.capacity) - num(s.filled),
    })),
    regularCandidates: regular.map((r) => ({
      classId: r.classId, name: r.name, instructor: r.instructor,
      schedule: `${r.dayOfWeek} ${r.startTime}~${r.endTime}`,
      nextDate: r.nextDate, nextLabel: r.nextDate ? seoulLabel(r.nextDate + "T00:00:00+09:00") : null,
      capacity: r.capacity, enrolled: r.enrolled,
      gradeAvg: r.gradeAvg == null ? null : Math.round(r.gradeAvg * 10) / 10,
      gradeDiff: r.gradeDiff == null ? null : Math.round(r.gradeDiff * 10) / 10,
    })),
  };
}

// 보강 생성 (관리자 직접=SCHEDULED / 학부모 신청=REQUESTED)
export async function createMakeup(input: {
  enrollmentDateId: string;
  targetType: "SEASONAL" | "REGULAR";
  targetSessionDateId?: string | null;
  targetClassId?: string | null;
  targetDate?: string | null;
  requestedBy?: "ADMIN" | "PARENT";
  userId?: string | null;
  note?: string | null;
}) {
  const absRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT e.id, e."applicationItemId", e."sessionDateId" AS "absentSessionDateId", e."studentId",
            it."offeringId", o.capacity
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
       JOIN "SpecialProgramOffering" o ON o.id = it."offeringId"
      WHERE e.id = $1 LIMIT 1`,
    input.enrollmentDateId,
  );
  const abs = absRows[0];
  if (!abs) throw new Error("ABSENCE_NOT_FOUND");

  const dup = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM "SpecialProgramMakeup"
      WHERE "applicationItemId" = $1 AND "absentSessionDateId" = $2 AND status NOT IN ('CANCELLED','REJECTED') LIMIT 1`,
    abs.applicationItemId, abs.absentSessionDateId,
  );
  if (dup[0]) throw new Error("MAKEUP_ALREADY_EXISTS");

  const requestedBy = input.requestedBy ?? "ADMIN";
  const status = requestedBy === "ADMIN" ? "SCHEDULED" : "REQUESTED";
  const id = randomUUID();

  if (input.targetType === "SEASONAL") {
    if (!input.targetSessionDateId) throw new Error("TARGET_SESSION_DATE_REQUIRED");
    const okRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT sd.id, COUNT(e2.id) FILTER (WHERE e2.status='SCHEDULED') AS filled
         FROM "SpecialProgramSessionDate" sd
         LEFT JOIN "SpecialProgramEnrollmentDate" e2 ON e2."sessionDateId"=sd.id AND e2.status<>'CANCELLED'
        WHERE sd.id = $1 AND sd."offeringId" = $2
        GROUP BY sd.id`,
      input.targetSessionDateId, abs.offeringId,
    );
    const target = okRows[0];
    if (!target) throw new Error("TARGET_NOT_IN_OFFERING");
    const cap = abs.capacity == null ? 999999 : Number(abs.capacity);
    if (num(target.filled) >= cap) throw new Error("TARGET_FULL");
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "SpecialProgramMakeup"
       ("id","applicationItemId","studentId","offeringId","absentSessionDateId","targetType",
        "targetSessionDateId","targetClassId","targetDate","status","requestedBy","requestedByUserId","approvedByUserId","decidedAt","note")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    id, abs.applicationItemId, abs.studentId ?? null, abs.offeringId, abs.absentSessionDateId, input.targetType,
    input.targetSessionDateId ?? null, input.targetClassId ?? null, input.targetDate ? new Date(input.targetDate) : null,
    status, requestedBy, requestedBy === "ADMIN" ? (input.userId ?? null) : null,
    requestedBy === "ADMIN" ? (input.userId ?? null) : null, requestedBy === "ADMIN" ? new Date() : null,
    input.note ?? null,
  );

  if (status === "SCHEDULED" && input.targetType === "SEASONAL") {
    await ensureSeasonalMakeupSlot(id);
  }
  return { id, status };
}

// 승인 시 특강 보강 대상 날짜에 수강일(kind=MAKEUP) 생성
async function ensureSeasonalMakeupSlot(makeupId: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT m.id, m."applicationItemId", m."studentId", m."offeringId", m."targetSessionDateId"
       FROM "SpecialProgramMakeup" m WHERE m.id = $1 AND m."targetType"='SEASONAL' AND m."targetSessionDateId" IS NOT NULL LIMIT 1`,
    makeupId,
  );
  const m = rows[0];
  if (!m) return;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "SpecialProgramEnrollmentDate"
       ("applicationItemId","offeringId","sessionDateId","studentId","kind","status","makeupId")
     VALUES ($1,$2,$3,$4,'MAKEUP','SCHEDULED',$5)
     ON CONFLICT ("applicationItemId","sessionDateId") DO UPDATE
       SET status='SCHEDULED', kind='MAKEUP', "makeupId"=EXCLUDED."makeupId", "updatedAt"=now()`,
    m.applicationItemId, m.offeringId, m.targetSessionDateId, m.studentId ?? null, m.id,
  );
}

// 보강 승인/거절/취소/출결확정
export async function decideMakeup(makeupId: string, action: "APPROVE" | "REJECT" | "CANCEL" | "ATTENDED" | "NO_SHOW", userId?: string | null) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, status, "targetType" FROM "SpecialProgramMakeup" WHERE id = $1 LIMIT 1`, makeupId,
  );
  const m = rows[0];
  if (!m) throw new Error("MAKEUP_NOT_FOUND");

  if (action === "APPROVE") {
    await prisma.$executeRawUnsafe(
      `UPDATE "SpecialProgramMakeup" SET status='SCHEDULED', "approvedByUserId"=$2, "decidedAt"=now(), "updatedAt"=now() WHERE id=$1`,
      makeupId, userId ?? null,
    );
    if (m.targetType === "SEASONAL") await ensureSeasonalMakeupSlot(makeupId);
    return { ok: true, status: "SCHEDULED" };
  }
  if (action === "REJECT" || action === "CANCEL") {
    const next = action === "REJECT" ? "REJECTED" : "CANCELLED";
    await prisma.$executeRawUnsafe(
      `UPDATE "SpecialProgramMakeup" SET status=$2, "approvedByUserId"=$3, "decidedAt"=now(), "updatedAt"=now() WHERE id=$1`,
      makeupId, next, userId ?? null,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "SpecialProgramEnrollmentDate" SET status='CANCELLED', "updatedAt"=now() WHERE "makeupId"=$1`, makeupId,
    );
    return { ok: true, status: next };
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "SpecialProgramMakeup" SET status=$2, "updatedAt"=now() WHERE id=$1`, makeupId, action,
  );
  return { ok: true, status: action };
}

// 보강 목록 (승인 대기 + 배정됨)
export async function listMakeups(seasonId?: string | null) {
  const params: any[] = [];
  let seasonWhere = "";
  if (seasonId) { params.push(seasonId); seasonWhere = ` AND o."seasonId" = $1`; }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT m.id, m.status, m."targetType", m."requestedBy", m."requestedAt",
            a."childName", a."childGrade", o.title AS "offeringTitle", o.capacity,
            absd."startsAt" AS "absentStartsAt",
            tsd."startsAt" AS "targetStartsAt", m."targetSessionDateId",
            c.name AS "targetClassName", m."targetDate", m."targetClassId",
            (SELECT COUNT(*) FROM "SpecialProgramEnrollmentDate" e2 WHERE e2."sessionDateId"=m."targetSessionDateId" AND e2.status='SCHEDULED') AS "targetFilled"
       FROM "SpecialProgramMakeup" m
       JOIN "SpecialProgramApplicationItem" it ON it.id = m."applicationItemId"
       JOIN "SpecialProgramApplication" a ON a.id = it."applicationId"
       JOIN "SpecialProgramOffering" o ON o.id = m."offeringId"
       LEFT JOIN "SpecialProgramSessionDate" absd ON absd.id = m."absentSessionDateId"
       LEFT JOIN "SpecialProgramSessionDate" tsd ON tsd.id = m."targetSessionDateId"
       LEFT JOIN "Class" c ON c.id = m."targetClassId"
      WHERE 1=1${seasonWhere}
      ORDER BY (m.status='REQUESTED') DESC, m."requestedAt" DESC`,
    ...params,
  );

  const map = (r: any) => ({
    id: r.id, status: r.status, targetType: r.targetType, requestedBy: r.requestedBy,
    childName: r.childName, childGrade: r.childGrade ?? null, offeringTitle: r.offeringTitle,
    absentLabel: r.absentStartsAt ? seoulLabel(r.absentStartsAt) : null,
    targetLabel: r.targetType === "SEASONAL"
      ? (r.targetStartsAt ? seoulLabel(r.targetStartsAt) : null)
      : (r.targetClassName ? `${r.targetClassName}${r.targetDate ? " · " + seoulLabel(r.targetDate) : ""}` : null),
    targetCapacity: r.capacity == null ? null : Number(r.capacity),
    targetFilled: r.targetSessionDateId ? num(r.targetFilled) : null,
  });

  const pending = rows.filter((r) => r.status === "REQUESTED").map(map);
  const assigned = rows.filter((r) => ["SCHEDULED", "APPROVED", "ATTENDED", "NO_SHOW"].includes(r.status)).map(map);
  return {
    pending, assigned,
    stats: {
      pending: pending.length,
      scheduled: rows.filter((r) => r.status === "SCHEDULED").length,
      attended: rows.filter((r) => r.status === "ATTENDED").length,
    },
  };
}
