import { Prisma, ShuttleRouteDirection, ShuttleRoutePlanStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertShuttleCapacity, assertUniqueStopOrders, ShuttleContractError } from "./contracts";
import { chooseActiveShuttleAssignment } from "./assignment";

export class ShuttleServiceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "INVALID_REQUEST",
  ) {
    super(message);
  }
}

function contract<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof ShuttleContractError) throw new ShuttleServiceError(error.message, error.status, error.code);
    throw error;
  }
}

type Db = Prisma.TransactionClient;
type Actor = { appUserId: string };
type StaffActor = Actor & { appUserRole: "ADMIN" | "VICE_ADMIN" | "INSTRUCTOR" | "DRIVER" };
type ShuttleRideStatus = "PENDING" | "BOARDED" | "DROPPED_OFF" | "NO_SHOW";

const SHUTTLE_RIDE_STATUSES = new Set<ShuttleRideStatus>(["PENDING", "BOARDED", "DROPPED_OFF", "NO_SHOW"]);

const routeInclude = {
  vehicle: true,
  driver: { select: { id: true, name: true, phone: true, role: true } },
  stops: {
    orderBy: { stopOrder: "asc" as const },
    include: { passengers: { orderBy: { createdAt: "asc" as const } } },
  },
} satisfies Prisma.ShuttleRoutePlanInclude;

function text(value: unknown, max = 200) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function integer(value: unknown, label: string, min = 0) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new ShuttleServiceError(`${label}을(를) 확인해 주세요.`, 400, "INVALID_NUMBER");
  }
  return parsed;
}

function coordinate(value: unknown, label: string, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ShuttleServiceError(`${label} 좌표를 확인해 주세요.`, 400, "INVALID_COORDINATE");
  }
  return parsed;
}

function optionalDate(value: unknown, label: string, dateOnly = false) {
  if (value === undefined || value === null || value === "") return null;
  const raw = String(value);
  const parsed = new Date(dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw);
  if (Number.isNaN(parsed.getTime())) throw new ShuttleServiceError(`${label}을(를) 확인해 주세요.`, 400, "INVALID_DATE");
  return parsed;
}

function plannedDate(value: unknown, serviceDate: Date | null) {
  if (value === undefined || value === null || value === "") return null;
  const raw = String(value);
  if (/^\d{2}:\d{2}$/.test(raw)) {
    if (!serviceDate) throw new ShuttleServiceError("예정 시간을 입력하려면 운행일을 먼저 지정해 주세요.", 409, "SERVICE_DATE_REQUIRED");
    const day = serviceDate.toISOString().slice(0, 10);
    return optionalDate(`${day}T${raw}:00+09:00`, "예정 시각");
  }
  return optionalDate(value, "예정 시각");
}

export function parseShuttleDirection(value: unknown): ShuttleRouteDirection {
  if (value !== ShuttleRouteDirection.PICKUP && value !== ShuttleRouteDirection.DROPOFF) {
    throw new ShuttleServiceError("등원 또는 하원 방향을 선택해 주세요.", 400, "INVALID_DIRECTION");
  }
  return value;
}

function point(data: Record<string, unknown>, prefix: "origin" | "destination") {
  const nested = data[prefix] && typeof data[prefix] === "object" ? data[prefix] as Record<string, unknown> : {};
  const name = text(data[`${prefix}Name`] ?? nested.name, 150);
  const address = text(data[`${prefix}Address`] ?? nested.address, 300);
  const latitudeValue = data[`${prefix}Latitude`] ?? data[`${prefix}Lat`] ?? nested.latitude ?? nested.lat;
  const longitudeValue = data[`${prefix}Longitude`] ?? data[`${prefix}Lng`] ?? nested.longitude ?? nested.lng;
  const latitude = latitudeValue === undefined || latitudeValue === null || latitudeValue === ""
    ? null
    : coordinate(latitudeValue, prefix === "origin" ? "출발지" : "도착지", -90, 90);
  const longitude = longitudeValue === undefined || longitudeValue === null || longitudeValue === ""
    ? null
    : coordinate(longitudeValue, prefix === "origin" ? "출발지" : "도착지", -180, 180);
  if ((latitude === null) !== (longitude === null)) {
    throw new ShuttleServiceError("위도와 경도는 함께 입력해 주세요.", 400, "INCOMPLETE_COORDINATE");
  }
  return { [`${prefix}Name`]: name ?? null, [`${prefix}Address`]: address ?? null, [`${prefix}Latitude`]: latitude, [`${prefix}Longitude`]: longitude };
}

function partialPoint(data: Record<string, unknown>, prefix: "origin" | "destination") {
  const keys = [prefix, `${prefix}Name`, `${prefix}Address`, `${prefix}Latitude`, `${prefix}Longitude`, `${prefix}Lat`, `${prefix}Lng`];
  return keys.some((key) => data[key] !== undefined) ? point(data, prefix) : {};
}

function presentRoute<T extends { stops: Array<{ latitude: number; longitude: number; passengers: unknown[] }> }>(route: T) {
  const values = route as T & { originLatitude?: number | null; originLongitude?: number | null; destinationLatitude?: number | null; destinationLongitude?: number | null };
  return {
    ...route,
    originLat: values.originLatitude,
    originLng: values.originLongitude,
    destinationLat: values.destinationLatitude,
    destinationLng: values.destinationLongitude,
    stops: route.stops.map((stop) => ({ ...stop, lat: stop.latitude, lng: stop.longitude })),
  };
}

async function audit(
  tx: Db,
  actor: Actor,
  action: string,
  references: { routePlanId?: string; vehicleId?: string; shuttleRequestId?: string },
  beforeJSON?: unknown,
  afterJSON?: unknown,
) {
  await tx.shuttleAuditLog.create({
    data: {
      ...references,
      actorId: actor.appUserId,
      action,
      beforeJSON: beforeJSON === undefined ? undefined : (beforeJSON as Prisma.InputJsonValue),
      afterJSON: afterJSON === undefined ? undefined : (afterJSON as Prisma.InputJsonValue),
    },
  });
}

async function ensureDriver(tx: Db, driverUserId: string) {
  const driver = await tx.user.findFirst({
    where: { id: driverUserId, role: "DRIVER" },
    select: { id: true, name: true, phone: true, role: true },
  });
  if (!driver) throw new ShuttleServiceError("셔틀 기사 계정을 선택해 주세요.", 409, "DRIVER_UNAVAILABLE");
  return driver;
}

export async function getShuttleDashboard(
  seasonId?: string,
  requestedDirection: unknown = ShuttleRouteDirection.PICKUP,
  requestedServiceDate?: unknown,
) {
  const selectedDirection = parseShuttleDirection(requestedDirection);
  const hasServiceDate = requestedServiceDate !== undefined && requestedServiceDate !== null && requestedServiceDate !== "";
  const selectedServiceDate = hasServiceDate ? optionalDate(requestedServiceDate, "운행일", true) : null;
  const seasons = await prisma.specialProgramSeason.findMany({
    orderBy: { startsAt: "desc" },
    select: { id: true, title: true, startsAt: true, endsAt: true },
  });
  const selectedSeasonId = seasonId || seasons[0]?.id || null;
  const [vehicles, routes, requests, drivers] = await Promise.all([
    prisma.shuttleVehicle.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    selectedSeasonId
      ? prisma.shuttleRoutePlan.findMany({
          where: { seasonId: selectedSeasonId },
          orderBy: [{ createdAt: "desc" }, { version: "desc" }],
          include: routeInclude,
        })
      : [],
    selectedSeasonId
      ? prisma.specialProgramShuttleRequest.findMany({
          where: {
            application: { seasonId: selectedSeasonId },
            routePassengers: {
              none: {
                routePlan: {
                  status: { not: ShuttleRoutePlanStatus.ARCHIVED },
                  direction: selectedDirection,
                  ...(hasServiceDate ? { serviceDate: selectedServiceDate } : {}),
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
          include: { application: true, applicationItem: { include: { offering: { select: { title: true } } } } },
        })
      : [],
    prisma.user.findMany({
      where: { role: "DRIVER" },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, phone: true, role: true },
    }),
  ]);

  const unassignedRequests = requests.map((request) => ({
    id: request.id,
    applicationItemId: request.applicationItemId,
    childName: request.application.childName,
    parentName: request.application.parentName,
    parentPhone: request.application.parentPhone,
    offeringTitle: request.applicationItem.offering.title,
    pickup: {
      name: request.pickupLocation,
      address: request.pickupAddress,
      roadAddress: request.pickupRoadAddress,
      lat: request.pickupLatitude,
      lng: request.pickupLongitude,
      confirmedAt: request.pickupConfirmedAt,
    },
    dropoff: {
      name: request.dropoffLocation,
      address: request.dropoffAddress,
      roadAddress: request.dropoffRoadAddress,
      lat: request.dropoffLatitude,
      lng: request.dropoffLongitude,
      confirmedAt: request.dropoffConfirmedAt,
    },
    pickupTime: request.pickupTime,
    note: request.note,
  }));

  return {
    seasons,
    selectedSeasonId,
    selectedDirection,
    selectedServiceDate,
    vehicles,
    drivers,
    routes: routes.map((route) => ({
      ...presentRoute(route),
      passengerCount: route.stops.reduce((sum, stop) => sum + stop.passengers.length, 0),
    })),
    unassignedRequests,
  };
}

export async function createVehicle(actor: Actor, input: Record<string, unknown>) {
  const name = text(input.name, 100);
  if (!name) throw new ShuttleServiceError("차량 이름을 입력해 주세요.", 400, "VEHICLE_NAME_REQUIRED");
  const capacity = integer(input.capacity, "정원", 1);
  return prisma.$transaction(async (tx) => {
    const vehicle = await tx.shuttleVehicle.create({
      data: { name, capacity, plateNumber: text(input.plateNumber, 30), notes: text(input.notes, 1000) },
    });
    await audit(tx, actor, "VEHICLE_CREATED", { vehicleId: vehicle.id }, undefined, vehicle);
    return vehicle;
  });
}

export async function updateVehicle(actor: Actor, id: string, input: Record<string, unknown>) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.shuttleVehicle.findUnique({ where: { id } });
    if (!before) throw new ShuttleServiceError("차량을 찾을 수 없습니다.", 404, "VEHICLE_NOT_FOUND");
    const data: Prisma.ShuttleVehicleUpdateInput = {};
    const nextCapacity = input.capacity !== undefined ? integer(input.capacity, "정원", 1) : null;
    if (input.name !== undefined) data.name = text(input.name, 100) || (() => { throw new ShuttleServiceError("차량 이름을 입력해 주세요."); })();
    if (nextCapacity !== null) data.capacity = nextCapacity;
    if (input.plateNumber !== undefined) data.plateNumber = text(input.plateNumber, 30) ?? null;
    if (input.notes !== undefined) data.notes = text(input.notes, 1000) ?? null;
    if (input.isActive !== undefined) data.isActive = input.isActive === true;
    const activePlans = await tx.shuttleRoutePlan.findMany({
      where: { vehicleId: id, status: { not: ShuttleRoutePlanStatus.ARCHIVED } },
      select: { id: true, status: true, _count: { select: { passengers: true } } },
    });
    if (nextCapacity !== null && activePlans.some((plan) => plan._count.passengers > nextCapacity)) {
      throw new ShuttleServiceError("현재 노선의 탑승 인원보다 차량 정원을 줄일 수 없습니다.", 409, "VEHICLE_CAPACITY_IN_USE");
    }
    if (data.isActive === false && activePlans.some((plan) => plan.status === ShuttleRoutePlanStatus.CONFIRMED)) {
      throw new ShuttleServiceError("확정 노선에 배정된 차량은 비활성화할 수 없습니다.", 409, "VEHICLE_IN_CONFIRMED_ROUTE");
    }
    const vehicle = await tx.shuttleVehicle.update({ where: { id }, data });
    await audit(tx, actor, "VEHICLE_UPDATED", { vehicleId: id }, before, vehicle);
    return vehicle;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createRoute(actor: Actor, input: Record<string, unknown>) {
  const seasonId = text(input.seasonId, 100);
  const name = text(input.name, 150);
  if (!seasonId || !name) throw new ShuttleServiceError("시즌과 노선 이름을 입력해 주세요.", 400, "ROUTE_FIELDS_REQUIRED");
  const routeDirection = parseShuttleDirection(input.direction);
  return prisma.$transaction(async (tx) => {
    const season = await tx.specialProgramSeason.findUnique({ where: { id: seasonId }, select: { id: true } });
    if (!season) throw new ShuttleServiceError("방학특강 시즌을 찾을 수 없습니다.", 404, "SEASON_NOT_FOUND");
    const vehicleId = text(input.vehicleId, 100);
    if (vehicleId) await ensureVehicle(tx, vehicleId);
    const driverUserId = text(input.driverUserId, 100);
    if (driverUserId) await ensureDriver(tx, driverUserId);
    const routeKey = crypto.randomUUID();
    const route = await tx.shuttleRoutePlan.create({
      data: {
        seasonId,
        vehicleId,
        driverUserId,
        routeKey,
        version: 1,
        name,
        direction: routeDirection,
        serviceDate: optionalDate(input.serviceDate, "운행일", true),
        ...point(input, "origin"),
        ...point(input, "destination"),
      },
      include: routeInclude,
    });
    await audit(tx, actor, "ROUTE_CREATED", { routePlanId: route.id }, undefined, route);
    return route;
  });
}

async function ensureVehicle(tx: Db, vehicleId: string) {
  const vehicle = await tx.shuttleVehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || !vehicle.isActive) throw new ShuttleServiceError("사용 가능한 차량을 찾을 수 없습니다.", 409, "VEHICLE_UNAVAILABLE");
  return vehicle;
}

async function draftRoute(tx: Db, id: string) {
  const route = await tx.shuttleRoutePlan.findUnique({ where: { id }, include: routeInclude });
  if (!route) throw new ShuttleServiceError("노선을 찾을 수 없습니다.", 404, "ROUTE_NOT_FOUND");
  if (route.status !== ShuttleRoutePlanStatus.DRAFT) {
    throw new ShuttleServiceError("확정된 노선은 직접 수정할 수 없습니다. 새 수정본을 만들어 주세요.", 409, "ROUTE_LOCKED");
  }
  return route;
}

async function syncLegacyAssignment(tx: Db, shuttleRequestId: string, preferredRouteId?: string) {
  const active = await tx.shuttleRoutePassenger.findMany({
    where: { shuttleRequestId, routePlan: { status: { not: ShuttleRoutePlanStatus.ARCHIVED } } },
    include: { routePlan: { select: { id: true, status: true, updatedAt: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const selected = chooseActiveShuttleAssignment(active, preferredRouteId);
  await tx.specialProgramShuttleRequest.update({
    where: { id: shuttleRequestId },
    data: selected
      ? { assignedRouteId: selected.routePlanId, assignedStopId: selected.stopId, status: "ASSIGNED" }
      : { assignedRouteId: null, assignedStopId: null, status: "REQUESTED" },
  });
}

export async function updateRoute(actor: Actor, id: string, input: Record<string, unknown>) {
  return prisma.$transaction(async (tx) => {
    const before = await draftRoute(tx, id);
    const data: Prisma.ShuttleRoutePlanUpdateInput = {};
    if (input.name !== undefined) data.name = text(input.name, 150) || (() => { throw new ShuttleServiceError("노선 이름을 입력해 주세요."); })();
    if (input.vehicleId !== undefined) {
      const vehicleId = text(input.vehicleId, 100);
      if (vehicleId) {
        const vehicle = await ensureVehicle(tx, vehicleId);
        const passengerCount = before.stops.reduce((sum, stop) => sum + stop.passengers.length, 0);
        if (passengerCount > vehicle.capacity) throw new ShuttleServiceError("차량 정원을 초과할 수 없습니다.", 409, "VEHICLE_CAPACITY_EXCEEDED");
      }
      data.vehicle = vehicleId ? { connect: { id: vehicleId } } : { disconnect: true };
    }
    if (input.driverUserId !== undefined) {
      const driverUserId = text(input.driverUserId, 100);
      if (driverUserId) {
        await ensureDriver(tx, driverUserId);
        data.driver = { connect: { id: driverUserId } };
      } else {
        data.driver = { disconnect: true };
      }
    }
    if (input.serviceDate !== undefined) {
      const nextServiceDate = optionalDate(input.serviceDate, "운행일", true);
      const shuttleRequestIds = before.stops.flatMap((stop) => stop.passengers.map((passenger) => passenger.shuttleRequestId));
      if (shuttleRequestIds.length) {
        const duplicate = await tx.shuttleRoutePassenger.findFirst({
          where: {
            shuttleRequestId: { in: shuttleRequestIds },
            routePlan: {
              id: { not: id }, seasonId: before.seasonId, direction: before.direction,
              serviceDate: nextServiceDate, status: { not: ShuttleRoutePlanStatus.ARCHIVED },
            },
          },
          select: { id: true },
        });
        if (duplicate) throw new ShuttleServiceError("변경할 운행일에 이미 배정된 학생이 있습니다.", 409, "DUPLICATE_ASSIGNMENT");
      }
      data.serviceDate = nextServiceDate;
    }
    Object.assign(data, partialPoint(input, "origin"), partialPoint(input, "destination"));
    const route = await tx.shuttleRoutePlan.update({ where: { id }, data, include: routeInclude });
    await audit(tx, actor, "ROUTE_UPDATED", { routePlanId: id }, before, route);
    return route;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function assignPassenger(actor: Actor, routeId: string, input: Record<string, unknown>) {
  const shuttleRequestId = text(input.shuttleRequestId, 100);
  const stopInput = input.stop && typeof input.stop === "object" ? input.stop as Record<string, unknown> : {};
  if (!shuttleRequestId) throw new ShuttleServiceError("셔틀 신청을 선택해 주세요.", 400, "REQUEST_REQUIRED");
  return prisma.$transaction(async (tx) => {
    const route = await draftRoute(tx, routeId);
    const request = await tx.specialProgramShuttleRequest.findUnique({
      where: { id: shuttleRequestId },
      include: { application: true },
    });
    if (!request || request.application.seasonId !== route.seasonId) {
      throw new ShuttleServiceError("해당 시즌의 셔틀 신청을 찾을 수 없습니다.", 404, "REQUEST_NOT_FOUND");
    }
    const location = route.direction === ShuttleRouteDirection.PICKUP
      ? { name: request.pickupLocation, address: request.pickupAddress, roadAddress: request.pickupRoadAddress, latitude: request.pickupLatitude, longitude: request.pickupLongitude, confirmedAt: request.pickupConfirmedAt }
      : { name: request.dropoffLocation, address: request.dropoffAddress, roadAddress: request.dropoffRoadAddress, latitude: request.dropoffLatitude, longitude: request.dropoffLongitude, confirmedAt: request.dropoffConfirmedAt };
    if (location.latitude === null || location.longitude === null || !location.confirmedAt) {
      throw new ShuttleServiceError("지도에서 확인된 위치가 필요합니다.", 409, "LOCATION_NOT_CONFIRMED");
    }
    const duplicate = await tx.shuttleRoutePassenger.findFirst({
      where: {
        shuttleRequestId,
        routePlan: {
          seasonId: route.seasonId,
          direction: route.direction,
          serviceDate: route.serviceDate,
          status: { not: ShuttleRoutePlanStatus.ARCHIVED },
        },
      },
    });
    if (duplicate) throw new ShuttleServiceError("이미 같은 운행 조건의 노선에 배정된 학생입니다.", 409, "DUPLICATE_ASSIGNMENT");
    if (route.vehicleId) {
      const vehicle = await ensureVehicle(tx, route.vehicleId);
      const count = await tx.shuttleRoutePassenger.count({ where: { routePlanId: routeId } });
      contract(() => assertShuttleCapacity(vehicle.capacity, count + 1));
    }
    let stop;
    const stopId = text(stopInput.id, 100);
    if (stopId) {
      stop = await tx.shuttleRouteStop.findFirst({ where: { id: stopId, routePlanId: routeId } });
      if (!stop) throw new ShuttleServiceError("정류장을 찾을 수 없습니다.", 404, "STOP_NOT_FOUND");
    } else {
      const last = await tx.shuttleRouteStop.aggregate({ where: { routePlanId: routeId }, _max: { stopOrder: true } });
      stop = await tx.shuttleRouteStop.create({
        data: {
          routePlanId: routeId,
          stopOrder: (last._max.stopOrder ?? 0) + 1,
          name: text(stopInput.name, 150) || location.name || location.address || "승하차 지점",
          address: text(stopInput.address, 300) || location.address || location.roadAddress || "주소 미입력",
          roadAddress: text(stopInput.roadAddress, 300) || location.roadAddress,
          latitude: stopInput.latitude === undefined && stopInput.lat === undefined ? location.latitude : coordinate(stopInput.latitude ?? stopInput.lat, "정류장", -90, 90),
          longitude: stopInput.longitude === undefined && stopInput.lng === undefined ? location.longitude : coordinate(stopInput.longitude ?? stopInput.lng, "정류장", -180, 180),
          plannedAt: plannedDate(stopInput.plannedAt, route.serviceDate),
          note: text(stopInput.note, 1000),
        },
      });
    }
    const passenger = await tx.shuttleRoutePassenger.create({
      data: {
        routePlanId: routeId,
        stopId: stop.id,
        shuttleRequestId,
        studentNameSnapshot: request.application.childName,
        parentNameSnapshot: request.application.parentName,
        parentPhoneSnapshot: request.application.parentPhone,
        note: text(input.note, 1000) || request.note,
      },
    });
    await syncLegacyAssignment(tx, shuttleRequestId, routeId);
    await audit(tx, actor, "PASSENGER_ASSIGNED", { routePlanId: routeId, shuttleRequestId }, undefined, passenger);
    return tx.shuttleRoutePlan.findUniqueOrThrow({ where: { id: routeId }, include: routeInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function unassignPassenger(actor: Actor, routeId: string, input: Record<string, unknown>) {
  const shuttleRequestId = text(input.shuttleRequestId, 100);
  if (!shuttleRequestId) throw new ShuttleServiceError("셔틀 신청을 선택해 주세요.");
  return prisma.$transaction(async (tx) => {
    await draftRoute(tx, routeId);
    const passenger = await tx.shuttleRoutePassenger.findUnique({ where: { routePlanId_shuttleRequestId: { routePlanId: routeId, shuttleRequestId } } });
    if (!passenger) throw new ShuttleServiceError("배정 정보를 찾을 수 없습니다.", 404, "ASSIGNMENT_NOT_FOUND");
    await tx.shuttleRoutePassenger.delete({ where: { id: passenger.id } });
    await syncLegacyAssignment(tx, shuttleRequestId);
    const remaining = await tx.shuttleRoutePassenger.count({ where: { stopId: passenger.stopId } });
    if (remaining === 0) await tx.shuttleRouteStop.delete({ where: { id: passenger.stopId } });
    await audit(tx, actor, "PASSENGER_UNASSIGNED", { routePlanId: routeId, shuttleRequestId }, passenger, undefined);
    return tx.shuttleRoutePlan.findUniqueOrThrow({ where: { id: routeId }, include: routeInclude });
  });
}

export async function reorderStops(actor: Actor, routeId: string, input: Record<string, unknown>) {
  const rows = Array.isArray(input.stops) ? input.stops : [];
  if (!rows.length) throw new ShuttleServiceError("정류장 순서를 입력해 주세요.");
  return prisma.$transaction(async (tx) => {
    const before = await draftRoute(tx, routeId);
    const parsed = rows.map((row, index) => {
      if (!row || typeof row !== "object") throw new ShuttleServiceError("정류장 순서를 확인해 주세요.");
      const item = row as Record<string, unknown>;
      const id = text(item.id, 100);
      if (!id) throw new ShuttleServiceError("정류장 ID가 필요합니다.");
      return { id, stopOrder: item.stopOrder === undefined ? index + 1 : integer(item.stopOrder, "정류장 순서", 1), plannedAt: item.plannedAt === undefined ? undefined : plannedDate(item.plannedAt, before.serviceDate) };
    });
    if (new Set(parsed.map((row) => row.id)).size !== parsed.length) {
      throw new ShuttleServiceError("정류장 또는 순서가 중복되었습니다.", 409, "DUPLICATE_STOP_ORDER");
    }
    contract(() => assertUniqueStopOrders(parsed));
    const existing = await tx.shuttleRouteStop.findMany({ where: { routePlanId: routeId }, select: { id: true } });
    if (existing.length !== parsed.length || existing.some((row) => !parsed.some((item) => item.id === row.id))) {
      throw new ShuttleServiceError("노선의 전체 정류장 순서를 보내 주세요.", 409, "STOP_SET_MISMATCH");
    }
    const maximumOrder = existing.length
      ? await tx.shuttleRouteStop.aggregate({ where: { routePlanId: routeId }, _max: { stopOrder: true } })
      : { _max: { stopOrder: 0 } };
    const temporaryOffset = maximumOrder._max.stopOrder ?? 0;
    for (const [index, row] of parsed.entries()) {
      await tx.shuttleRouteStop.update({ where: { id: row.id }, data: { stopOrder: temporaryOffset + index + 1 } });
    }
    for (const row of parsed) {
      await tx.shuttleRouteStop.update({ where: { id: row.id }, data: { stopOrder: row.stopOrder, ...(row.plannedAt !== undefined ? { plannedAt: row.plannedAt } : {}) } });
    }
    const route = await tx.shuttleRoutePlan.findUniqueOrThrow({ where: { id: routeId }, include: routeInclude });
    await audit(tx, actor, "STOPS_REORDERED", { routePlanId: routeId }, before.stops, route.stops);
    return route;
  });
}

export async function confirmRoute(actor: Actor, routeId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await draftRoute(tx, routeId);
    if (!before.vehicleId) throw new ShuttleServiceError("노선을 확정하려면 차량을 배정해 주세요.", 409, "VEHICLE_REQUIRED");
    if (!before.driverUserId) throw new ShuttleServiceError("노선을 확정하려면 셔틀 기사를 배정해 주세요.", 409, "DRIVER_REQUIRED");
    const vehicle = await ensureVehicle(tx, before.vehicleId);
    const passengerCount = before.stops.reduce((sum, stop) => sum + stop.passengers.length, 0);
    if (!passengerCount) throw new ShuttleServiceError("한 명 이상의 학생을 배정해 주세요.", 409, "PASSENGER_REQUIRED");
    contract(() => assertShuttleCapacity(vehicle.capacity, passengerCount));
    const previousPassengerRows = await tx.shuttleRoutePassenger.findMany({
      where: { routePlan: { routeKey: before.routeKey, id: { not: routeId }, status: ShuttleRoutePlanStatus.CONFIRMED } },
      select: { shuttleRequestId: true },
    });
    // 같은 routeKey의 이전 확정본은 보관 처리해 실제 운행 기준을 항상 한 버전으로 유지한다.
    await tx.shuttleRoutePlan.updateMany({
      where: { routeKey: before.routeKey, id: { not: routeId }, status: ShuttleRoutePlanStatus.CONFIRMED },
      data: { status: ShuttleRoutePlanStatus.ARCHIVED },
    });
    const route = await tx.shuttleRoutePlan.update({ where: { id: routeId }, data: { status: ShuttleRoutePlanStatus.CONFIRMED, confirmedAt: new Date(), confirmedByUserId: actor.appUserId }, include: routeInclude });
    const currentRequestIds = new Set(route.stops.flatMap((stop) => stop.passengers.map((passenger) => passenger.shuttleRequestId)));
    const affectedRequestIds = new Set([...previousPassengerRows.map((row) => row.shuttleRequestId), ...currentRequestIds]);
    for (const shuttleRequestId of affectedRequestIds) {
      await syncLegacyAssignment(tx, shuttleRequestId, currentRequestIds.has(shuttleRequestId) ? route.id : undefined);
    }
    await audit(tx, actor, "ROUTE_CONFIRMED", { routePlanId: routeId }, before, route);
    return route;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function archiveRoute(actor: Actor, routeId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.shuttleRoutePlan.findUnique({ where: { id: routeId }, include: routeInclude });
    if (!before) throw new ShuttleServiceError("노선을 찾을 수 없습니다.", 404, "ROUTE_NOT_FOUND");
    const route = await tx.shuttleRoutePlan.update({ where: { id: routeId }, data: { status: ShuttleRoutePlanStatus.ARCHIVED }, include: routeInclude });
    const requestIds = new Set(before.stops.flatMap((stop) => stop.passengers.map((passenger) => passenger.shuttleRequestId)));
    for (const shuttleRequestId of requestIds) await syncLegacyAssignment(tx, shuttleRequestId);
    await audit(tx, actor, "ROUTE_ARCHIVED", { routePlanId: routeId }, before, route);
    return route;
  });
}

export async function reviseRoute(actor: Actor, routeId: string) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.shuttleRoutePlan.findUnique({ where: { id: routeId }, include: routeInclude });
    if (!source) throw new ShuttleServiceError("노선을 찾을 수 없습니다.", 404, "ROUTE_NOT_FOUND");
    if (source.status !== ShuttleRoutePlanStatus.CONFIRMED) throw new ShuttleServiceError("확정된 노선만 수정본을 만들 수 있습니다.", 409, "ROUTE_NOT_CONFIRMED");
    const existingDraft = await tx.shuttleRoutePlan.findFirst({
      where: { routeKey: source.routeKey, status: ShuttleRoutePlanStatus.DRAFT },
      orderBy: { version: "desc" },
      include: routeInclude,
    });
    if (existingDraft) return existingDraft;
    const latest = await tx.shuttleRoutePlan.aggregate({ where: { routeKey: source.routeKey }, _max: { version: true } });
    const draft = await tx.shuttleRoutePlan.create({
      data: {
        seasonId: source.seasonId, vehicleId: source.vehicleId, driverUserId: source.driverUserId, routeKey: source.routeKey, version: (latest._max.version ?? source.version) + 1,
        name: source.name, direction: source.direction, serviceDate: source.serviceDate,
        originName: source.originName, originAddress: source.originAddress, originLatitude: source.originLatitude, originLongitude: source.originLongitude,
        destinationName: source.destinationName, destinationAddress: source.destinationAddress, destinationLatitude: source.destinationLatitude, destinationLongitude: source.destinationLongitude,
        previousVersionId: source.id,
      },
    });
    for (const sourceStop of source.stops) {
      const stop = await tx.shuttleRouteStop.create({
        data: {
          routePlanId: draft.id, stopOrder: sourceStop.stopOrder, name: sourceStop.name, address: sourceStop.address,
          roadAddress: sourceStop.roadAddress, latitude: sourceStop.latitude, longitude: sourceStop.longitude,
          plannedAt: sourceStop.plannedAt, note: sourceStop.note,
        },
      });
      if (sourceStop.passengers.length) {
        await tx.shuttleRoutePassenger.createMany({
          data: sourceStop.passengers.map((passenger) => ({
            routePlanId: draft.id, stopId: stop.id, shuttleRequestId: passenger.shuttleRequestId,
            studentNameSnapshot: passenger.studentNameSnapshot, parentNameSnapshot: passenger.parentNameSnapshot,
            parentPhoneSnapshot: passenger.parentPhoneSnapshot, note: passenger.note,
          })),
        });
      }
    }
    const route = await tx.shuttleRoutePlan.findUniqueOrThrow({ where: { id: draft.id }, include: routeInclude });
    for (const shuttleRequestId of new Set(source.stops.flatMap((stop) => stop.passengers.map((passenger) => passenger.shuttleRequestId)))) {
      await syncLegacyAssignment(tx, shuttleRequestId);
    }
    await audit(tx, actor, "ROUTE_REVISION_CREATED", { routePlanId: route.id }, source, route);
    return route;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function koreaDateOnly(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function getStaffShuttleDashboard(actor: Actor & { appUserRole: "ADMIN" | "VICE_ADMIN" | "INSTRUCTOR" | "DRIVER" }) {
  const todayKey = koreaDateOnly();
  const today = new Date(`${todayKey}T00:00:00.000Z`);
  const isDriver = actor.appUserRole === "DRIVER";
  const routes = await prisma.shuttleRoutePlan.findMany({
    where: {
      status: ShuttleRoutePlanStatus.CONFIRMED,
      ...(isDriver ? { driverUserId: actor.appUserId } : {}),
      OR: [{ serviceDate: null }, { serviceDate: { gte: today } }],
    },
    orderBy: [{ serviceDate: "asc" }, { direction: "asc" }, { name: "asc" }],
    take: 12,
    include: routeInclude,
  });

  return {
    todayKey,
    routes: routes.map((route) => ({
      ...presentRoute(route),
      passengerCount: route.stops.reduce((sum, stop) => sum + stop.passengers.length, 0),
    })),
  };
}

function parseRideStatus(value: unknown): ShuttleRideStatus {
  if (typeof value !== "string" || !SHUTTLE_RIDE_STATUSES.has(value as ShuttleRideStatus)) {
    throw new ShuttleServiceError("탑승 상태를 확인해 주세요.", 400, "INVALID_RIDE_STATUS");
  }
  return value as ShuttleRideStatus;
}

function assertRideStatusMatchesDirection(direction: ShuttleRouteDirection, status: ShuttleRideStatus) {
  if (status === "PENDING" || status === "NO_SHOW") return;
  if (direction === ShuttleRouteDirection.PICKUP && status !== "BOARDED") {
    throw new ShuttleServiceError("등원 노선에서는 탑승 상태만 처리할 수 있습니다.", 400, "INVALID_PICKUP_STATUS");
  }
  if (direction === ShuttleRouteDirection.DROPOFF && status !== "DROPPED_OFF") {
    throw new ShuttleServiceError("하원 노선에서는 하차 상태만 처리할 수 있습니다.", 400, "INVALID_DROPOFF_STATUS");
  }
}

export async function updatePassengerRideStatus(actor: StaffActor, routeId: string, passengerId: string, statusValue: unknown) {
  const status = parseRideStatus(statusValue);
  return prisma.$transaction(async (tx) => {
    const route = await tx.shuttleRoutePlan.findUnique({
      where: { id: routeId },
      select: { id: true, driverUserId: true, direction: true, status: true },
    });
    if (!route || route.status !== ShuttleRoutePlanStatus.CONFIRMED) {
      throw new ShuttleServiceError("확정된 운행 노선만 체크할 수 있습니다.", 404, "CONFIRMED_ROUTE_NOT_FOUND");
    }
    if (actor.appUserRole === "DRIVER" && route.driverUserId !== actor.appUserId) {
      throw new ShuttleServiceError("담당 기사에게 배정된 노선만 체크할 수 있습니다.", 403, "DRIVER_ROUTE_FORBIDDEN");
    }
    if (actor.appUserRole === "INSTRUCTOR") {
      throw new ShuttleServiceError("셔틀 체크 권한이 없습니다.", 403, "SHUTTLE_CHECK_FORBIDDEN");
    }
    assertRideStatusMatchesDirection(route.direction, status);
    const before = await tx.shuttleRoutePassenger.findFirst({ where: { id: passengerId, routePlanId: routeId } });
    if (!before) throw new ShuttleServiceError("탑승 학생을 찾을 수 없습니다.", 404, "PASSENGER_NOT_FOUND");
    const passenger = await tx.shuttleRoutePassenger.update({
      where: { id: passengerId },
      data: {
        rideStatus: status,
        rideStatusUpdatedAt: status === "PENDING" ? null : new Date(),
        rideStatusUpdatedByUserId: status === "PENDING" ? null : actor.appUserId,
      },
    });
    await audit(tx, actor, "PASSENGER_RIDE_STATUS_UPDATED", { routePlanId: routeId, shuttleRequestId: passenger.shuttleRequestId }, before, passenger);
    return passenger;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
