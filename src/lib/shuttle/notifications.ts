import { prisma } from "@/lib/prisma";
import { sendParentSmsWithResult } from "@/lib/notification";
import { buildNoShowEventId, isSafeShuttleSmsRetry } from "./notification-policy";

type PassengerNotice = {
  id: string;
  logicalKey: string | null;
  studentName: string;
  phone: string;
  stopName: string;
  plannedAt: Date | null;
};

const KOREA_TIME_ZONE = "Asia/Seoul";

function normalizePhone(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

function logicalPassengerKey(passenger: {
  sourceType: string;
  shuttleRequestId: string | null;
  studentId: string | null;
  sessionId: string | null;
  locationKind: string | null;
}) {
  if (passenger.sourceType === "SPECIAL_PROGRAM") {
    return passenger.shuttleRequestId ? `special:${passenger.shuttleRequestId}` : null;
  }
  return passenger.studentId && passenger.sessionId && passenger.locationKind
    ? `regular:${passenger.studentId}:${passenger.sessionId}:${passenger.locationKind}`
    : null;
}

function dateLabel(value: Date | null) {
  if (!value) return "운행일 확인 중";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(value);
}

function timeLabel(value: Date | null) {
  if (!value) return "시간 확인 중";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

function directionLabel(direction: string) {
  return direction === "PICKUP" ? "등원" : "하원";
}

async function sendShuttleParentSms(
  phone: string,
  trigger: string,
  variables: Record<string, string>,
  eventType: string,
  eventId: string,
) {
  const first = await sendParentSmsWithResult(phone, trigger, variables, { eventType, eventId });
  if (first.ok) return first;

  console.error("[shuttle sms failed]", { eventType, eventId, reason: first.reason ?? "SMS_SEND_FAILED" });
  if (!isSafeShuttleSmsRetry(first)) return first;

  const retry = await sendParentSmsWithResult(phone, trigger, variables, {
    eventType,
    eventId,
    deliveryRunId: "safe-retry-1",
  });
  if (!retry.ok) {
    console.error("[shuttle sms retry failed]", { eventType, eventId, reason: retry.reason ?? "SMS_SEND_FAILED" });
  }
  return retry;
}

function serviceDateKey(value: Date | null) {
  if (!value) return "date-pending";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function flattenPassengers(stops: Array<{
  name: string;
  plannedAt: Date | null;
  passengers: Array<{
    id: string;
    sourceType: string;
    shuttleRequestId: string | null;
    studentId: string | null;
    sessionId: string | null;
    locationKind: string | null;
    studentNameSnapshot: string;
    parentPhoneSnapshot: string | null;
  }>;
}>): PassengerNotice[] {
  return stops.flatMap((stop) => stop.passengers.map((passenger) => ({
    id: passenger.id,
    logicalKey: logicalPassengerKey(passenger) ?? `passenger:${passenger.id}`,
    studentName: passenger.studentNameSnapshot,
    phone: normalizePhone(passenger.parentPhoneSnapshot) ?? "",
    stopName: stop.name,
    plannedAt: stop.plannedAt,
  })));
}

function noticeFingerprint(passenger: PassengerNotice, direction: string, serviceDate: Date | null) {
  return JSON.stringify([
    passenger.studentName,
    direction,
    serviceDate?.toISOString() ?? null,
    passenger.stopName,
    passenger.plannedAt?.toISOString() ?? null,
    passenger.phone,
  ]);
}

const noticeRouteSelect = {
  id: true,
  version: true,
  direction: true,
  serviceDate: true,
  previousVersionId: true,
  stops: {
    select: {
      name: true,
      plannedAt: true,
      passengers: {
        select: {
          id: true,
          sourceType: true,
          shuttleRequestId: true,
          studentId: true,
          sessionId: true,
          locationKind: true,
          studentNameSnapshot: true,
          parentPhoneSnapshot: true,
        },
      },
    },
  },
} as const;

export async function notifyShuttleRouteConfirmed(routeId: string) {
  try {
    const route = await prisma.shuttleRoutePlan.findUnique({
      where: { id: routeId },
      select: noticeRouteSelect,
    });
    if (!route) return;

    const previous = route.previousVersionId
      ? await prisma.shuttleRoutePlan.findUnique({
        where: { id: route.previousVersionId },
        select: noticeRouteSelect,
      })
      : null;
    const previousByKey = new Map(
      flattenPassengers(previous?.stops ?? [])
        .filter((passenger) => passenger.logicalKey)
        .map((passenger) => [passenger.logicalKey!, noticeFingerprint(passenger, previous!.direction, previous!.serviceDate)]),
    );

    const notices = flattenPassengers(route.stops).filter((passenger) => {
      if (!passenger.logicalKey || !passenger.phone) return false;
      return previousByKey.get(passenger.logicalKey) !== noticeFingerprint(passenger, route.direction, route.serviceDate);
    });

    const results = await Promise.allSettled(notices.map((passenger) => sendShuttleParentSms(
      passenger.phone,
      "SHUTTLE_ROUTE_CONFIRMED_PARENT",
      {
        학생명: passenger.studentName,
        운행방향: directionLabel(route.direction),
        운행일: dateLabel(route.serviceDate),
        정류장: passenger.stopName,
        예정시간: timeLabel(passenger.plannedAt),
      },
      "SHUTTLE_ROUTE_CONFIRMED",
      `route:${route.id}:v${route.version}:passenger:${passenger.logicalKey}`,
    )));
    for (const result of results) {
      if (result.status === "rejected") console.error("[shuttle route confirmed sms]", result.reason);
      else if (!result.value.ok) console.error("[shuttle route confirmed sms result]", result.value.reason);
    }
  } catch (error) {
    console.error("[shuttle route confirmed notification]", error);
  }
}

export async function notifyShuttlePassengerNoShow(routeId: string, passengerId: string) {
  try {
    const passenger = await prisma.shuttleRoutePassenger.findFirst({
      where: { id: passengerId, routePlanId: routeId },
      select: {
        id: true,
        sourceType: true,
        shuttleRequestId: true,
        studentId: true,
        sessionId: true,
        locationKind: true,
        studentNameSnapshot: true,
        parentPhoneSnapshot: true,
        stop: { select: { name: true, plannedAt: true } },
        routePlan: { select: { id: true, direction: true, serviceDate: true } },
      },
    });
    const phone = normalizePhone(passenger?.parentPhoneSnapshot ?? null);
    if (!passenger || !phone) return;
    const logicalKey = logicalPassengerKey(passenger);
    if (!logicalKey) {
      console.error("[shuttle no-show notification] stable passenger key unavailable");
      return;
    }
    const eventId = buildNoShowEventId(
      logicalKey,
      serviceDateKey(passenger.routePlan.serviceDate),
      passenger.routePlan.direction,
    );

    await sendShuttleParentSms(
      phone,
      "SHUTTLE_NO_SHOW_PARENT",
      {
        학생명: passenger.studentNameSnapshot,
        운행방향: directionLabel(passenger.routePlan.direction),
        운행일: dateLabel(passenger.routePlan.serviceDate),
        정류장: passenger.stop.name,
        예정시간: timeLabel(passenger.stop.plannedAt),
      },
      "SHUTTLE_PASSENGER_NO_SHOW",
      eventId,
    );
  } catch (error) {
    console.error("[shuttle no-show notification]", error);
  }
}
