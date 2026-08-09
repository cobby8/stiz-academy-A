import { prisma } from "@/lib/prisma";
import { notMergedStudent } from "@/lib/studentVisibility";
import {
  SHUTTLE_EXCEPTION_MESSAGE,
  validateShuttleException,
  type ShuttleDirection,
  type ShuttleExceptionKind,
} from "@/lib/shuttle/dayExceptionRules";

// ── 학부모의 "오늘만" 셔틀 변경 ──────────────────────────────────────────────
//
// 결석 신고와 같은 성격이다: 승인 없이 바로 반영하고 원장에게는 알림만 보낸다.
// 기사님 화면이 그날 명단을 만들 때 이 표를 함께 읽는다.
//
// ★ 보안 가드:
//   1) IDOR — studentId 가 그 부모의 자녀인지 SQL 로 재검증.
//   2) 날짜는 서버 기준(KST)으로 판정 — 클라이언트 시계를 믿으면 지난 날도 바꿀 수 있다.
//   3) 같은 학생·날짜·방향에 살아있는 예외는 한 건(DB 부분 유니크가 최종 방어선).

function kstTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export type ShuttleExceptionRow = {
  id: string;
  studentId: string;
  studentName: string;
  serviceDate: string;
  direction: string;
  kind: string;
  location: string | null;
  note: string | null;
};

export type ShuttleExceptionOptions = {
  today: string;
  maxDate: string;
  children: { studentId: string; studentName: string }[];
  upcoming: ShuttleExceptionRow[];
};

export async function getShuttleExceptionOptions(parentUserId: string): Promise<ShuttleExceptionOptions> {
  const today = kstTodayYmd();
  const { addDays, MAX_DAYS_AHEAD } = await import("@/lib/shuttle/dayExceptionRules");

  const children = await prisma.$queryRawUnsafe<any[]>(
    // 셔틀은 정규 수강생만 탄다. 지금 다니는 자녀만 보여준다.
    `SELECT DISTINCT s.id AS "studentId", s.name AS "studentName"
       FROM "Student" s
       JOIN "Enrollment" e ON e."studentId" = s.id AND e.status = 'ACTIVE'
      WHERE s."parentId" = $1 AND ${notMergedStudent("s")}
      ORDER BY s.name`,
    parentUserId,
  );

  const upcoming = await prisma.$queryRawUnsafe<any[]>(
    `SELECT x.id, x."studentId", s.name AS "studentName",
            to_char(x."serviceDate",'YYYY-MM-DD') AS "serviceDate",
            x.direction, x.kind, x.location, x.note
       FROM "ShuttleDayException" x
       JOIN "Student" s ON s.id = x."studentId"
      WHERE s."parentId" = $1 AND x."canceledAt" IS NULL
        AND x."serviceDate" >= $2::date
      ORDER BY x."serviceDate", s.name`,
    parentUserId, today,
  );

  return {
    today,
    maxDate: addDays(today, MAX_DAYS_AHEAD),
    children: children.map((row) => ({ studentId: row.studentId, studentName: row.studentName })),
    upcoming: upcoming.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      studentName: row.studentName,
      serviceDate: row.serviceDate,
      direction: row.direction,
      kind: row.kind,
      location: row.location ?? null,
      note: row.note ?? null,
    })),
  };
}

export type SubmitShuttleExceptionInput = {
  studentId?: string;
  serviceDate?: unknown;
  direction?: unknown;
  kind?: unknown;
  location?: unknown;
  note?: unknown;
};

export async function submitShuttleException(parentUserId: string, input: SubmitShuttleExceptionInput) {
  const studentId = typeof input.studentId === "string" ? input.studentId.trim() : "";
  if (!studentId) return { ok: false as const, message: "자녀를 선택해 주세요." };

  // 가드1: 그 부모의 자녀이고 지금 다니는 학생인지 재검증.
  const owned = await prisma.$queryRawUnsafe<any[]>(
    `SELECT s.id, s.name
       FROM "Student" s
       JOIN "Enrollment" e ON e."studentId" = s.id AND e.status = 'ACTIVE'
      WHERE s.id = $1 AND s."parentId" = $2
      LIMIT 1`,
    studentId, parentUserId,
  );
  if (!owned[0]) return { ok: false as const, message: "본인 자녀만 신청할 수 있습니다." };

  // 가드2: 날짜 판정은 서버 시계(KST)로 한다.
  const checked = validateShuttleException(input, { today: kstTodayYmd() });
  if (!checked.ok) return { ok: false as const, message: SHUTTLE_EXCEPTION_MESSAGE[checked.error] };
  const direction: ShuttleDirection = checked.direction;
  const kind: ShuttleExceptionKind = checked.kind;

  const serviceDate = String(input.serviceDate);
  const location = kind === "LOCATION" ? String(input.location).trim().slice(0, 200) : null;
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 300) || null : null;

  // 가드3: 같은 날·같은 방향에 이미 있으면 덮어쓴다(학부모가 마음을 바꾼 것).
  // 두 건이 살아 있으면 기사님이 무엇을 따를지 모른다.
  await prisma.$executeRawUnsafe(
    `UPDATE "ShuttleDayException"
        SET "canceledAt" = now(), "updatedAt" = now()
      WHERE "studentId" = $1 AND "serviceDate" = $2::date AND direction = $3
        AND "canceledAt" IS NULL`,
    studentId, serviceDate, direction,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ShuttleDayException"
        ("studentId","serviceDate","direction","kind","location","note","requestedByUserId")
     VALUES ($1,$2::date,$3,$4,$5,$6,$7)`,
    studentId, serviceDate, direction, kind, location, note, parentUserId,
  );

  await notifyAdminsOfShuttleException({
    studentName: owned[0].name,
    serviceDate,
    direction,
    kind,
    location,
  });

  return { ok: true as const };
}

export async function cancelShuttleException(parentUserId: string, exceptionId: string) {
  const id = exceptionId?.trim();
  if (!id) return { ok: false as const, message: "취소할 신청을 찾을 수 없습니다." };

  const canceled = Number(
    await prisma.$executeRawUnsafe(
      `UPDATE "ShuttleDayException" x
          SET "canceledAt" = now(), "updatedAt" = now()
         FROM "Student" s
        WHERE x."studentId" = s.id AND s."parentId" = $1
          AND x.id = $2 AND x."canceledAt" IS NULL`,
      parentUserId, id,
    ),
  );
  if (canceled === 0) return { ok: false as const, message: "이미 취소된 신청입니다." };
  return { ok: true as const };
}

/**
 * 기사님 명단이 읽는 그날 예외 목록.
 *
 * 정규 셔틀 명단(RegularShuttleStop)은 구글시트에서 온 **글자**라 학생 id 가 없다.
 * 그래서 결석 매칭과 같은 방식으로 이름·전화로 이어 붙인다.
 */
export async function getShuttleExceptionsForDate(date: string): Promise<
  { name: string; phone: string | null; direction: string; kind: string; location: string | null }[]
> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT s.name AS name, u.phone AS phone, x.direction, x.kind, x.location
         FROM "ShuttleDayException" x
         JOIN "Student" s ON s.id = x."studentId"
         LEFT JOIN "User" u ON u.id = s."parentId"
        WHERE x."serviceDate" = $1::date AND x."canceledAt" IS NULL`,
      date,
    );
    return rows
      .map((row) => ({
        name: String(row.name ?? "").trim(),
        phone: (row.phone as string | null) ?? null,
        direction: row.direction,
        kind: row.kind,
        location: row.location ?? null,
      }))
      .filter((row) => row.name.length > 0);
  } catch (error) {
    // 예외 표를 못 읽어도 운행 명단 자체는 떠야 한다.
    console.error("[shuttle day exception] 조회 실패:", error);
    return [];
  }
}

async function notifyAdminsOfShuttleException(input: {
  studentName: string;
  serviceDate: string;
  direction: string;
  kind: string;
  location: string | null;
}) {
  try {
    const { notifyAdmins } = await import("@/lib/notification");
    const { SHUTTLE_DIRECTION_LABEL, SHUTTLE_EXCEPTION_KIND_LABEL } = await import(
      "@/lib/shuttle/dayExceptionRules"
    );
    const what = input.kind === "SKIP"
      ? SHUTTLE_EXCEPTION_KIND_LABEL.SKIP
      : `${SHUTTLE_EXCEPTION_KIND_LABEL.LOCATION} (${input.location ?? "-"})`;
    // 코치 SMS 는 보내지 않는다 — 기사님은 운행 화면에서 바로 본다.
    await notifyAdmins(
      "SHUTTLE_EXCEPTION",
      "셔틀 당일 변경",
      `${input.studentName} · ${input.serviceDate} · ${SHUTTLE_DIRECTION_LABEL[input.direction as ShuttleDirection] ?? input.direction} · ${what}`,
      "/admin/shuttle",
      { notifyCoaches: false },
    );
  } catch (error) {
    console.error("[parent-shuttle-exception] 원장 알림 실패:", error);
  }
}
