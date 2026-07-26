import { prisma } from "@/lib/prisma";
import { NOT_MERGED_STUDENT } from "@/lib/studentVisibility";
// 셔틀 대상자는 게이트웨이 한 곳으로만 읽는다(원본 신청 테이블을 여기서 직접 조회하지 않는다).
import { getConfirmedShuttleRoster } from "@/lib/seasonal/shuttleRoster";

export type ParentShuttleOverviewItem = {
  id: string;
  studentId: string;
  sourceType: "REGULAR_CLASS" | "SPECIAL_PROGRAM";
  direction: "PICKUP" | "DROPOFF" | null;
  status: "REQUESTED" | "PREPARING" | "CONFIRMED" | "COMPLETED";
  label: string;
  title: string;
  serviceDate: string | null;
  routeName: string | null;
  stopName: string | null;
  stopAddress: string | null;
  plannedAt: string | null;
  vehicleName: string | null;
  rideStatus: string | null;
};

type RouteStatus = "DRAFT" | "CONFIRMED" | "COMPLETED";
type RegularApplicationRow = {
  id: string;
  childName: string;
  childBirthDate: Date;
  convertedStudentId: string | null;
  assignedClassId: string | null;
};

function dateOnly(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function dateTime(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function overviewStatus(routeStatus: RouteStatus | null) {
  if (!routeStatus) return "REQUESTED" as const;
  if (routeStatus === "DRAFT") return "PREPARING" as const;
  if (routeStatus === "COMPLETED") return "COMPLETED" as const;
  return "CONFIRMED" as const;
}

function studentIdentity(name: string, birthDate: Date) {
  return `${name.trim()}:${birthDate.toISOString().slice(0, 10)}`;
}

function preferRouteVersion<T extends { routePlan: { status: string; version: number } }>(
  current: T | undefined,
  candidate: T,
) {
  if (!current) return candidate;
  const currentIsOperational = current.routePlan.status === "CONFIRMED" || current.routePlan.status === "COMPLETED";
  const candidateIsOperational = candidate.routePlan.status === "CONFIRMED" || candidate.routePlan.status === "COMPLETED";
  if (currentIsOperational !== candidateIsOperational) return candidateIsOperational ? candidate : current;
  return candidate.routePlan.version > current.routePlan.version ? candidate : current;
}

/**
 * 인증된 학부모의 앱 계정 ID만 사용해 자녀 셔틀 현황을 조회한다.
 * 전화번호 기반 매칭과 기사·다른 승객·좌표 조회는 의도적으로 하지 않는다.
 */
export async function getParentShuttleOverview(appUserId: string): Promise<ParentShuttleOverviewItem[]> {
  const students = await prisma.student.findMany({
    // 병합으로 흡수된 학생은 학부모 마이페이지에서도 보이지 않아야 한다
    where: { parentId: appUserId, ...NOT_MERGED_STUDENT },
    select: { id: true, name: true, birthDate: true },
  });
  if (students.length === 0) return [];

  const studentIds = students.map((student) => student.id);
  const studentNames = new Map(students.map((student) => [student.id, student.name]));

  const [regularPassengers, seasonalRoster, regularApplications] = await Promise.all([
    prisma.shuttleRoutePassenger.findMany({
      where: {
        sourceType: "REGULAR_CLASS",
        studentId: { in: studentIds },
        routePlan: { status: { not: "ARCHIVED" } },
      },
      select: {
        id: true,
        studentId: true,
        sessionId: true,
        locationKind: true,
        rideStatus: true,
        session: { select: { classId: true, class: { select: { name: true } } } },
        routePlan: {
          select: {
            routeKey: true,
            version: true,
            name: true,
            direction: true,
            status: true,
            serviceDate: true,
            vehicle: { select: { name: true } },
          },
        },
        stop: { select: { name: true, address: true, roadAddress: true, plannedAt: true } },
      },
    }),
    // ⚠️ 셔틀 대상자는 원본 테이블에서 직접 찾지 않는다. 게이트웨이만 통과한다.
    // 자녀 필터는 게이트웨이가 준 studentId(전환 완료된 경우에만 채워진다)로 아래에서 건다.
    getConfirmedShuttleRoster(),
    prisma.$queryRawUnsafe<RegularApplicationRow[]>(
      `SELECT id, "childName", "childBirthDate", "convertedStudentId", "assignedClassId"
         FROM "EnrollmentApplication"
        WHERE "shuttleNeeded" = true
          AND status IN ('PENDING', 'APPROVED')
          AND ("parentUserId" = $1 OR "convertedStudentId" = ANY($2::text[]))
        ORDER BY "updatedAt" DESC`,
      appUserId,
      studentIds,
    ),
  ]);

  // 이 학부모의 자녀에 해당하는 확정 명단만 남긴다.
  // studentId는 학생 전환이 끝난 경우에만 채워지므로, 기존의 `conversionStatus = COMPLETED` 조건과 같다.
  // 미탑승(ride=false)은 예전에도 목록에서 빠졌으므로 그대로 제외한다.
  const seasonalEntries = seasonalRoster.filter(
    (entry) => entry.ride && entry.studentId != null && studentIds.includes(entry.studentId),
  );
  // 확정 명단에 붙은 실제 노선 배정. 예전에는 findMany의 중첩 relation이 하던 일이다.
  const seasonalPassengers = seasonalEntries.length
    ? await prisma.shuttleRoutePassenger.findMany({
        where: {
          shuttleRequestId: { in: seasonalEntries.map((entry) => entry.shuttleRequestId) },
          routePlan: { status: { not: "ARCHIVED" } },
        },
        select: {
          id: true,
          shuttleRequestId: true,
          rideStatus: true,
          routePlan: {
            select: {
              routeKey: true,
              version: true,
              name: true,
              direction: true,
              status: true,
              serviceDate: true,
              vehicle: { select: { name: true } },
            },
          },
          stop: { select: { name: true, address: true, roadAddress: true, plannedAt: true } },
        },
      })
    : [];
  const passengersByRequest = new Map<string, typeof seasonalPassengers>();
  for (const passenger of seasonalPassengers) {
    if (!passenger.shuttleRequestId) continue;
    const list = passengersByRequest.get(passenger.shuttleRequestId) ?? [];
    list.push(passenger);
    passengersByRequest.set(passenger.shuttleRequestId, list);
  }

  // 같은 routeKey의 과거 버전만 접는다. 날짜·방향·세션이 다른 실제 운행은 각각 남긴다.
  const regularByRoute = new Map<string, (typeof regularPassengers)[number]>();
  for (const passenger of regularPassengers) {
    if (!passenger.studentId) continue;
    const key = [passenger.studentId, passenger.sessionId, passenger.locationKind, passenger.routePlan.routeKey].join(":");
    const current = regularByRoute.get(key);
    regularByRoute.set(key, preferRouteVersion(current, passenger));
  }

  const regularItems = [...regularByRoute.values()].map<ParentShuttleOverviewItem>((passenger) => {
    const isDraft = passenger.routePlan.status === "DRAFT";
    return {
      id: passenger.id,
      studentId: passenger.studentId!,
      sourceType: "REGULAR_CLASS",
      direction: passenger.routePlan.direction,
      status: overviewStatus(passenger.routePlan.status as RouteStatus),
      label: studentNames.get(passenger.studentId!) ?? "자녀",
      title: passenger.session?.class.name ?? "정규 수업",
      serviceDate: isDraft ? null : dateOnly(passenger.routePlan.serviceDate),
      routeName: isDraft ? null : passenger.routePlan.name,
      stopName: isDraft ? null : passenger.stop.name,
      stopAddress: isDraft ? null : (passenger.stop.roadAddress || passenger.stop.address),
      plannedAt: isDraft ? null : dateTime(passenger.stop.plannedAt),
      vehicleName: isDraft ? null : (passenger.routePlan.vehicle?.name ?? null),
      rideStatus: isDraft ? null : passenger.rideStatus,
    };
  });

  const specialItems = seasonalEntries.flatMap<ParentShuttleOverviewItem>((entry) => {
    const routePassengers = passengersByRequest.get(entry.shuttleRequestId) ?? [];
    const activeByRoute = new Map<string, (typeof routePassengers)[number]>();
    for (const passenger of routePassengers) {
      const current = activeByRoute.get(passenger.routePlan.routeKey);
      activeByRoute.set(passenger.routePlan.routeKey, preferRouteVersion(current, passenger));
    }
    if (activeByRoute.size === 0) {
      return [{
        id: entry.shuttleRequestId,
        studentId: entry.studentId!,
        sourceType: "SPECIAL_PROGRAM",
        direction: null,
        status: "REQUESTED",
        label: entry.studentName,
        title: entry.offeringTitle ?? "방학특강",
        serviceDate: null,
        routeName: null,
        stopName: null,
        stopAddress: null,
        plannedAt: null,
        vehicleName: null,
        rideStatus: null,
      }];
    }
    return [...activeByRoute.values()].map((passenger) => {
      const isDraft = passenger.routePlan.status === "DRAFT";
      return {
        id: passenger.id,
        studentId: entry.studentId!,
        sourceType: "SPECIAL_PROGRAM",
        direction: passenger.routePlan.direction,
        status: overviewStatus(passenger.routePlan.status as RouteStatus),
        label: entry.studentName,
        title: entry.offeringTitle ?? "방학특강",
        serviceDate: isDraft ? null : dateOnly(passenger.routePlan.serviceDate),
        routeName: isDraft ? null : passenger.routePlan.name,
        stopName: isDraft ? null : passenger.stop.name,
        stopAddress: isDraft ? null : (passenger.stop.roadAddress || passenger.stop.address),
        plannedAt: isDraft ? null : dateTime(passenger.stop.plannedAt),
        vehicleName: isDraft ? null : (passenger.routePlan.vehicle?.name ?? null),
        rideStatus: isDraft ? null : passenger.rideStatus,
      };
    });
  });

  const studentByIdentity = new Map<string, string | null>();
  for (const student of students) {
    const key = studentIdentity(student.name, student.birthDate);
    studentByIdentity.set(key, studentByIdentity.has(key) ? null : student.id);
  }
  const assignedClassKeys = new Set(
    regularPassengers
      .filter((passenger) => passenger.studentId && passenger.session?.classId)
      .map((passenger) => `${passenger.studentId}:${passenger.session!.classId}`),
  );
  const regularRequestItems = regularApplications.flatMap<ParentShuttleOverviewItem>((application) => {
    const studentId = application.convertedStudentId
      ? (studentIds.includes(application.convertedStudentId) ? application.convertedStudentId : null)
      : studentByIdentity.get(studentIdentity(application.childName, application.childBirthDate));
    if (!studentId) return [];
    // 신청서-승객 직접 FK가 없어 같은 학생·배정 반 승객이 있으면 중복 신청 카드를 만들지 않는다.
    if (application.assignedClassId && assignedClassKeys.has(`${studentId}:${application.assignedClassId}`)) return [];
    return [{
      id: `enrollment-application:${application.id}`,
      studentId,
      sourceType: "REGULAR_CLASS",
      direction: null,
      status: "REQUESTED",
      label: studentNames.get(studentId) ?? application.childName,
      title: "정규 수업 셔틀 신청",
      serviceDate: null,
      routeName: null,
      stopName: null,
      stopAddress: null,
      plannedAt: null,
      vehicleName: null,
      rideStatus: null,
    }];
  });

  return [...regularItems, ...specialItems, ...regularRequestItems].sort((left, right) => {
    return (right.serviceDate ?? "").localeCompare(left.serviceDate ?? "") || left.label.localeCompare(right.label, "ko");
  });
}

// 학부모에게 제공하는 셔틀 기사님 연락처. 공용 DRIVER 계정의 이름·전화만 노출한다(민감정보 최소화).
export async function getShuttleDriverContact(): Promise<{ name: string; phone: string } | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT name, phone FROM "User"
      WHERE role = 'DRIVER' AND phone IS NOT NULL AND btrim(phone) <> ''
      ORDER BY "updatedAt" DESC NULLS LAST LIMIT 1`,
  );
  const r = rows[0];
  if (!r?.phone) return null;
  return { name: (r.name && String(r.name).trim()) || "셔틀 기사", phone: String(r.phone) };
}
