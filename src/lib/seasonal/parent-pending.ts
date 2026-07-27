import { prisma } from "@/lib/prisma";
import {
  groupPendingChildren,
  type PendingSeatRow,
  type PendingSeasonalChild,
} from "@/lib/seasonal/pendingSeasonalChildren";

// ── 방학특강 "미전환(전환 대기) 자녀" 조회 (읽기 전용) ─────────────────────────
// 부모 계정의 전화번호로 방학특강 신청(SpecialProgramApplication)을 조회해,
// 아직 정식 학생(Student)으로 전환되지 않은 자녀를 별도로 뽑아준다.
// getMyPageData(Student 테이블 기반)로는 안 보이는 자녀를 보완하는 용도.
//
// ★ IDOR 방어: 화면/클라이언트가 보낸 전화번호를 쓰지 않는다.
//   게이트(requireVerifiedParent)로 검증된 parentUserId 로 User.phone 을 직접 조회해
//   그 전화번호로만 매칭한다 → 남의 자녀 노출 불가.
//   (getUpcomingSeasonalSeats(parent-absence.ts)의 전화번호 소유권 매칭 패턴 재사용)

function digits(s?: string | null) {
  return (s || "").replace(/\D/g, "");
}

async function parentPhone(parentUserId: string) {
  const u = await prisma.$queryRawUnsafe<any[]>(
    `SELECT phone FROM "User" WHERE id = $1 LIMIT 1`,
    parentUserId,
  );
  return digits(u[0]?.phone);
}

// studentIds = 현재 대시보드(getMyPageData)에 이미 뜨는 정식 학생 id 목록.
//   → 이미 전환된 신청을 걸러 정식 카드와 중복 노출되지 않게 한다.
export async function getPendingSeasonalChildren(
  parentUserId: string,
  studentIds: string[] = [],
): Promise<PendingSeasonalChild[]> {
  const phone = await parentPhone(parentUserId);
  if (!phone) return []; // 전화번호가 없으면 매칭 불가 → 빈 배열(안전)

  // 신청 → 항목(offering) → 좌석(회차) LEFT JOIN.
  // 좌석이 없는 신청도 특강 이름은 뜨도록 LEFT JOIN 사용.
  // 전환 판정 필드(convertedStudentId, conversionStatus)는 순수 로직에서 필터한다.
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT a.id AS "applicationId",
            a."childName" AS "childName",
            a."childGrade" AS "childGrade",
            a."convertedStudentId" AS "convertedStudentId",
            it."conversionStatus" AS "conversionStatus",
            o.title AS "offeringTitle",
            e.id AS "enrollmentDateId",
            (sd."startsAt" > now()) AS "isFuture",
            e."attendanceStatus" AS "attendanceStatus"
       FROM "SpecialProgramApplication" a
       JOIN "SpecialProgramApplicationItem" it ON it."applicationId" = a.id
       JOIN "SpecialProgramOffering" o ON o.id = it."offeringId"
       LEFT JOIN "SpecialProgramEnrollmentDate" e
              ON e."applicationItemId" = it.id AND e.status = 'SCHEDULED'
       LEFT JOIN "SpecialProgramSessionDate" sd ON sd.id = e."sessionDateId"
      WHERE regexp_replace(a."parentPhone", '[^0-9]', '', 'g') = $1
        AND it.status = 'APPROVED'
      ORDER BY a."childName" ASC, sd."startsAt" ASC`,
    phone,
  );

  const seatRows: PendingSeatRow[] = rows.map((r) => ({
    applicationId: r.applicationId,
    childName: r.childName ?? null,
    childGrade: r.childGrade ?? null,
    convertedStudentId: r.convertedStudentId ?? null,
    conversionStatus: r.conversionStatus ?? null,
    offeringTitle: r.offeringTitle ?? null,
    enrollmentDateId: r.enrollmentDateId ?? null,
    isFuture: r.isFuture ?? null,
    attendanceStatus: r.attendanceStatus ?? null,
  }));

  return groupPendingChildren(seatRows, studentIds);
}
