import { prisma } from "@/lib/prisma";
import { REASON_LABEL, isValidReason, defaultResolution } from "@/lib/seasonal/parentAbsenceRules";

// ── 방학특강 "학부모 사전 결석 신고" (4a-2) ────────────────────────────────
// 학부모가 자녀의 "아직 오지 않은" 특강 회차를 사유와 함께 미리 결석 신고/취소한다.
// 신고하면 그 좌석(SpecialProgramEnrollmentDate)의 attendanceStatus가 'EXCUSED'가 되어
// 셔틀 배차에서 그날 자동 제외된다(4a-1과 자동 연동, 추가 배선 불필요).
//
// ★ 3대 보안 가드(반드시 유지):
//   1) IDOR 방어 — 클라이언트가 보낸 enrollmentDateId를 신뢰하지 않고,
//      로그인한 부모 계정의 전화번호로 소유권을 SQL 조인으로 재검증(parent-makeup.ts와 동일).
//   2) 선생님/관리자 확정 좌석 보호 — attendanceStatus가 이미 채워진 좌석(선생님이 출결 확정)엔
//      손대지 않는다. 원자적 UPDATE ... WHERE attendanceStatus IS NULL 로 경합까지 차단.
//   3) 미래만 — 지난 회차(startsAt <= now())는 신고 불가.

function digits(s?: string | null) {
  return (s || "").replace(/\D/g, "");
}

// 사유 라벨·허용집합·기본 resolution 은 순수 모듈(parentAbsenceRules)에서 재사용한다.

// 회차 날짜 라벨: "7/28(화) 15:00"
function seoulDateTimeLabel(value: Date | string | null) {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  const f = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.month)}/${Number(p.day)}(${(p.weekday || "").replace("요일", "")}) ${p.hour}:${p.minute}`;
}

async function parentPhone(parentUserId: string) {
  const u = await prisma.$queryRawUnsafe<any[]>(
    `SELECT phone FROM "User" WHERE id = $1 LIMIT 1`,
    parentUserId,
  );
  return digits(u[0]?.phone);
}

// ── 1) 예정 회차(미래·SCHEDULED) 목록 ─────────────────────────────────────
// 부모 전화번호 소유의 좌석 중 "아직 오지 않은" 것 + 현재 출결상태 + 연결된 결석신고(있으면).
// 미전환 자녀도 전화번호 기반 조인이라 자동 포함된다.
export async function getUpcomingSeasonalSeats(parentUserId: string) {
  const phone = await parentPhone(parentUserId);
  if (!phone) return { phoneKnown: false, seats: [] };

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT e.id AS "enrollmentDateId",
            a."childName" AS "childName",
            o.title AS "offeringTitle",
            sd."startsAt" AS "startsAt",
            e."attendanceStatus" AS "attendanceStatus",
            ab.reason AS "absenceReason",
            ab.resolution AS "absenceResolution",
            ab.status AS "absenceStatus"
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
       JOIN "SpecialProgramApplication" a ON a.id = it."applicationId"
       JOIN "SpecialProgramSessionDate" sd ON sd.id = e."sessionDateId"
       JOIN "SpecialProgramOffering" o ON o.id = e."offeringId"
       LEFT JOIN "SpecialProgramAbsence" ab ON ab."enrollmentDateId" = e.id
      WHERE e.status = 'SCHEDULED' AND sd."startsAt" > now()
        AND regexp_replace(a."parentPhone", '[^0-9]', '', 'g') = $1
      ORDER BY sd."startsAt" ASC`,
    phone,
  );

  return {
    phoneKnown: true,
    seats: rows.map((r) => {
      // 이미 신고된(본인) 상태인지: 결석신고가 있고 status='REPORTED' 이며 좌석이 EXCUSED
      const reported = !!r.absenceReason;
      return {
        enrollmentDateId: r.enrollmentDateId,
        childName: r.childName,
        offeringTitle: r.offeringTitle,
        dateLabel: seoulDateTimeLabel(r.startsAt),
        attendanceStatus: r.attendanceStatus, // null | PRESENT | LATE | ABSENT | EXCUSED
        reported,
        reason: r.absenceReason || null,
        reasonLabel: r.absenceReason ? REASON_LABEL[r.absenceReason] || r.absenceReason : null,
        resolution: r.absenceResolution || null,
        absenceStatus: r.absenceStatus || null, // REPORTED | CONFIRMED | CANCELLED
        // 관리자가 이미 확정(CONFIRMED)했거나, 선생님이 다른 출결(PRESENT 등)을 찍은 경우 학부모는 손댈 수 없다
        locked: r.absenceStatus === "CONFIRMED" || (r.attendanceStatus != null && r.attendanceStatus !== "EXCUSED"),
      };
    }),
  };
}

// ── 2) 사전 결석 신고 ─────────────────────────────────────────────────────
export async function reportSeasonalAbsence(
  parentUserId: string,
  input: { enrollmentDateId: string; reason: string },
) {
  const enrollmentDateId = input?.enrollmentDateId;
  const reason = input?.reason;
  if (!enrollmentDateId) throw new Error("SEAT_NOT_FOUND");
  if (!isValidReason(reason)) throw new Error("INVALID_REASON");

  const phone = await parentPhone(parentUserId);
  if (!phone) throw new Error("PARENT_PHONE_UNKNOWN");

  // 가드1: 소유권 재검증 + 현재 상태 조회(클라 값 신뢰 금지)
  const own = await prisma.$queryRawUnsafe<any[]>(
    `SELECT e.id, e.status AS "seatStatus", e."attendanceStatus",
            (sd."startsAt" > now()) AS "isFuture"
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
       JOIN "SpecialProgramApplication" a ON a.id = it."applicationId"
       JOIN "SpecialProgramSessionDate" sd ON sd.id = e."sessionDateId"
      WHERE e.id = $1
        AND regexp_replace(a."parentPhone", '[^0-9]', '', 'g') = $2
      LIMIT 1`,
    enrollmentDateId, phone,
  );
  if (!own[0]) throw new Error("NOT_OWNER");
  const seat = own[0];

  // 가드3: 미래만 / 좌석이 아직 유효(SCHEDULED)해야
  if (seat.seatStatus !== "SCHEDULED") throw new Error("SEAT_NOT_SCHEDULED");
  if (!seat.isFuture) throw new Error("PAST_SESSION");
  // 가드2: 선생님/관리자가 이미 출결을 확정한 좌석(attendanceStatus 채워짐)이면 차단
  if (seat.attendanceStatus != null) throw new Error("ALREADY_CHECKED");

  // 원자적 UPDATE — attendanceStatus IS NULL 인 좌석만 EXCUSED로.
  // (위 SELECT 이후 선생님이 동시에 출결을 찍는 경합까지 여기서 차단)
  const affected = await prisma.$executeRawUnsafe(
    `UPDATE "SpecialProgramEnrollmentDate"
        SET "attendanceStatus" = 'EXCUSED',
            "attendanceCheckedByUserId" = $2,
            "attendanceCheckedAt" = now(),
            "updatedAt" = now()
      WHERE id = $1
        AND status = 'SCHEDULED'
        AND "attendanceStatus" IS NULL`,
    enrollmentDateId, parentUserId,
  );
  if (Number(affected) === 0) throw new Error("ALREADY_CHECKED");

  // 결석신고 INSERT — 좌석당 1건(ON CONFLICT). 관리자가 이미 CONFIRMED 한 건은 덮어쓰지 않는다.
  const resolution = defaultResolution(reason);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "SpecialProgramAbsence"
        ("enrollmentDateId","reason","resolution","status","reportedByUserId")
     VALUES ($1,$2,$3,'REPORTED',$4)
     ON CONFLICT ("enrollmentDateId") DO UPDATE
        SET reason = EXCLUDED.reason,
            resolution = EXCLUDED.resolution,
            status = 'REPORTED',
            "reportedByUserId" = EXCLUDED."reportedByUserId",
            "updatedAt" = now()
      WHERE "SpecialProgramAbsence".status <> 'CONFIRMED'`,
    enrollmentDateId, reason, resolution, parentUserId,
  );

  return { ok: true, reason, resolution };
}

// ── 3) 사전 결석 신고 취소 ────────────────────────────────────────────────
export async function cancelSeasonalAbsence(
  parentUserId: string,
  input: { enrollmentDateId: string },
) {
  const enrollmentDateId = input?.enrollmentDateId;
  if (!enrollmentDateId) throw new Error("SEAT_NOT_FOUND");

  const phone = await parentPhone(parentUserId);
  if (!phone) throw new Error("PARENT_PHONE_UNKNOWN");

  // 가드1: 소유권 재검증
  const own = await prisma.$queryRawUnsafe<any[]>(
    `SELECT e.id
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
       JOIN "SpecialProgramApplication" a ON a.id = it."applicationId"
      WHERE e.id = $1
        AND regexp_replace(a."parentPhone", '[^0-9]', '', 'g') = $2
      LIMIT 1`,
    enrollmentDateId, phone,
  );
  if (!own[0]) throw new Error("NOT_OWNER");

  // 가드2: 본인이 신고한(status='REPORTED') 건만 삭제. 관리자 확정(CONFIRMED)이면 0행 → 차단.
  // (원자적 DELETE ... WHERE status='REPORTED' 가 선생님/관리자 확정 보호 역할)
  const deleted = await prisma.$executeRawUnsafe(
    `DELETE FROM "SpecialProgramAbsence"
      WHERE "enrollmentDateId" = $1 AND status = 'REPORTED'`,
    enrollmentDateId,
  );
  if (Number(deleted) === 0) throw new Error("ABSENCE_NOT_CANCELABLE");

  // 좌석 EXCUSED → NULL 복귀. EXCUSED 일 때만(선생님이 다른 상태로 바꿨으면 건드리지 않음).
  await prisma.$executeRawUnsafe(
    `UPDATE "SpecialProgramEnrollmentDate"
        SET "attendanceStatus" = NULL,
            "attendanceCheckedByUserId" = NULL,
            "attendanceCheckedAt" = NULL,
            "updatedAt" = now()
      WHERE id = $1 AND "attendanceStatus" = 'EXCUSED'`,
    enrollmentDateId,
  );

  return { ok: true };
}
