import { prisma } from "@/lib/prisma";
import { weekdayInSeoul } from "@/lib/seasonal/planning";

// 방학특강 출석 라이브러리 — 모든 쿼리는 PgBouncer 트랜잭션 모드 호환을 위해 $queryRawUnsafe 사용.
// 출석은 학생(Student) 전환 여부와 무관하게 SpecialProgramEnrollmentDate 행에 직접 기록한다.

export const SEASONAL_ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;
export type SeasonalAttendanceStatus = (typeof SEASONAL_ATTENDANCE_STATUSES)[number];
const VALID_ATTENDANCE = new Set<string>(SEASONAL_ATTENDANCE_STATUSES);

// 신청 요일 키(MON~SUN)를 한글 한 글자로 바꾸는 표. 화면 뱃지(예: "월·수")에 사용한다.
const WEEKDAY_KO_BY_KEY: Record<string, string> = {
  MON: "월", TUE: "화", WED: "수", THU: "목", FRI: "금", SAT: "토", SUN: "일",
};

// DB의 selectedWeekdays(TEXT[])를 안전하게 문자열 배열로 정리한다. (null·잘못된 값 방어)
function weekdayKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim().toUpperCase()).filter((v) => v in WEEKDAY_KO_BY_KEY);
}

// ["MON","WED"] → "월·수". 값이 없으면 null을 돌려 화면에서 뱃지를 숨긴다.
function weekdayLabel(keys: string[]): string | null {
  if (keys.length === 0) return null;
  return keys.map((k) => WEEKDAY_KO_BY_KEY[k]).join("·");
}

function seoulParts(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  // 요일 키는 기존 KST 유틸(weekdayInSeoul)을 재사용해 서울시간 기준으로 계산한다.
  const weekdayKey = weekdayInSeoul(d);
  return {
    dateLabel: `${Number(parts.month)}/${Number(parts.day)}`,
    // 한글 요일 라벨도 서울시간 기준 요일 키에서 뽑아 Intl 로케일 차이에 흔들리지 않게 한다.
    dayLabel: WEEKDAY_KO_BY_KEY[weekdayKey] ?? (parts.weekday || "").replace("요일", ""),
    weekdayKey,
    timeLabel: `${parts.hour}:${parts.minute}`,
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function num(v: unknown) { return v == null ? 0 : Number(v); }

// 특강(반) 전체 승인 학생 수 — 날짜별 명단과 같은 기준(승인된 신청항목 + 취소 아닌 정규 배정)으로 센다.
// 학생마다 신청 요일이 달라 "이 날 명단 인원"은 이 값보다 작을 수 있다. 그걸 화면에서 설명하기 위한 값.
async function countApprovedStudents(offeringId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: unknown }>>(
    `SELECT COUNT(DISTINCT e."applicationItemId") AS total
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramSessionDate" sd ON sd.id = e."sessionDateId"
       JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
      WHERE sd."offeringId" = $1
        AND e.status <> 'CANCELLED'
        AND e.kind = 'REGULAR'
        AND it.status = 'APPROVED'`,
    offeringId,
  );
  return num(rows[0]?.total);
}

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

// 1-1) 상단 탭 "보강 관리" 빨간 뱃지용 — 승인 대기(REQUESTED) 보강 신청 건수만 센다.
// 목록 전체(listMakeups)를 부르면 무거우므로 COUNT만 조회한다. 조회 전용(DB 변경 없음).
// 보관(ARCHIVED) 시즌은 더 이상 처리할 수 없는 건이라 제외 → 뱃지가 영구히 남는 것을 방지한다.
export async function countPendingMakeups(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: unknown }>>(
    `SELECT COUNT(*) AS total
       FROM "SpecialProgramMakeup" m
       JOIN "SpecialProgramOffering" o ON o.id = m."offeringId"
       JOIN "SpecialProgramSeason" s ON s.id = o."seasonId"
      WHERE m.status = 'REQUESTED'
        AND s.status <> 'ARCHIVED'`,
  );
  return num(rows[0]?.total);
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

  // 반 전체 승인 인원(요일 무관)을 함께 조회해 "13명 중 이 날 6명" 안내를 만들 수 있게 한다.
  const totalApprovedStudents = await countApprovedStudents(offeringId);

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
      dateLabel: p.dateLabel, dayLabel: p.dayLabel, weekdayKey: p.weekdayKey,
      startTime: p.timeLabel, endTime: end.timeLabel,
      ymd: p.ymd, location: r.location ?? null,
      capacity, scheduled, makeup: num(r.makeup),
      present: num(r.present), late: num(r.late), absent: num(r.absent), excused: num(r.excused),
      unchecked: num(r.unchecked), checked, state,
    };
  });
  return {
    offering: {
      id: offering.id, title: offering.title, capacity,
      instructorName: offering.instructorName ?? null,
      totalApprovedStudents, // 반 전체 승인 학생 수(요일 무관)
    },
    totalApprovedStudents,
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

  // 명단 기준: 승인된 신청항목(it.status='APPROVED') + 취소되지 않은 좌석.
  // 승인 시 좌석이 자동 생성되므로, 나중에 거절/취소로 바뀌어도 좌석은 남는다(삭제 경로 없음).
  // 신청항목 상태를 같이 걸러야 그 학생이 출석부에서 빠지고, 위 countApprovedStudents 와 기준이 일치한다.
  // 보강(kind='MAKEUP') 좌석도 결석한 정규 좌석과 같은 신청항목을 가리키므로 승인 상태면 그대로 표시된다.
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT e.id AS "enrollmentDateId", e.kind, e.status, e."attendanceStatus", e."arrivedAt", e."attendanceNote",
            it.id AS "itemId", a."childName", a."childGrade", a."childSchool", a."parentName", a."parentPhone",
            a."selectedWeekdays",
            mk."absentSessionDateId", absd."startsAt" AS "originStartsAt"
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
       JOIN "SpecialProgramApplication" a ON a.id = it."applicationId"
       LEFT JOIN "SpecialProgramMakeup" mk ON mk.id = e."makeupId"
       LEFT JOIN "SpecialProgramSessionDate" absd ON absd.id = mk."absentSessionDateId"
      WHERE e."sessionDateId" = $1 AND e.status <> 'CANCELLED'
        AND it.status = 'APPROVED'
      ORDER BY (e.kind = 'MAKEUP') ASC, a."childName" ASC`,
    sessionDateId,
  );

  const p = seoulParts(meta.startsAt);
  const end = seoulParts(meta.endsAt);
  // 이 반의 전체 승인 인원 — 명단 인원(요일이 맞는 학생만)과 비교해 오해를 막는 안내에 쓴다.
  const totalApprovedStudents = await countApprovedStudents(meta.offeringId);
  return {
    date: {
      sessionDateId: meta.id, offeringId: meta.offeringId, offeringTitle: meta.offeringTitle,
      dateLabel: p.dateLabel, dayLabel: p.dayLabel, weekdayKey: p.weekdayKey,
      startTime: p.timeLabel, endTime: end.timeLabel,
      location: meta.location ?? null, capacity: meta.capacity == null ? null : Number(meta.capacity),
      instructorName: meta.instructorName ?? null,
      totalApprovedStudents,
    },
    totalApprovedStudents,
    rows: rows.map((r) => {
      const selectedWeekdays = weekdayKeys(r.selectedWeekdays);
      return {
        enrollmentDateId: r.enrollmentDateId, kind: r.kind, enrollmentStatus: r.status,
        attendanceStatus: r.attendanceStatus ?? null, arrivedAt: r.arrivedAt ?? null, attendanceNote: r.attendanceNote ?? null,
        itemId: r.itemId, childName: r.childName, childGrade: r.childGrade ?? null, childSchool: r.childSchool ?? null,
        parentName: r.parentName, parentPhone: r.parentPhone,
        selectedWeekdays, // 학생이 신청한 요일 키 목록 (예: ["MON","WED"])
        selectedWeekdayLabel: weekdayLabel(selectedWeekdays), // 화면용 라벨 (예: "월·수")
        originAbsence: r.absentSessionDateId ? seoulParts(r.originStartsAt).dateLabel : null,
      };
    }),
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
