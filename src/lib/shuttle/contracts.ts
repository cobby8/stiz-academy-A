export const SHUTTLE_ROUTE_DIRECTIONS = ["PICKUP", "DROPOFF"] as const;
export const SHUTTLE_ROUTE_PLAN_STATUSES = ["DRAFT", "CONFIRMED", "ARCHIVED"] as const;

export type ShuttleRouteDirection = (typeof SHUTTLE_ROUTE_DIRECTIONS)[number];
export type ShuttleRoutePlanStatus = (typeof SHUTTLE_ROUTE_PLAN_STATUSES)[number];

export type ShuttleVehicleInput = {
  name: string;
  plateNumber?: string;
  capacity: number;
  isActive: boolean;
  notes?: string;
};

export type ShuttleRoutePlanInput = {
  seasonId: string;
  vehicleId?: string;
  routeKey: string;
  name: string;
  direction: ShuttleRouteDirection;
  serviceDate?: string;
  origin?: ShuttleEndpointInput;
  destination?: ShuttleEndpointInput;
};

export type ShuttleEndpointInput = {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

export type ShuttleRouteStopInput = {
  stopOrder: number;
  name: string;
  address: string;
  roadAddress?: string;
  latitude: number;
  longitude: number;
  plannedAt?: string;
  note?: string;
};

export type ShuttleRoutePassengerInput = {
  stopId: string;
  shuttleRequestId: string;
  studentNameSnapshot: string;
  parentNameSnapshot?: string;
  parentPhoneSnapshot?: string;
  note?: string;
};

export class ShuttleContractError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = "INVALID_SHUTTLE_REQUEST", status = 400) {
    super(message);
    this.name = "ShuttleContractError";
    this.status = status;
    this.code = code;
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ShuttleContractError("요청 형식을 확인해 주세요.");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, maxLength: number, required = false): string | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (required && !normalized) {
    throw new ShuttleContractError("필수 입력값을 확인해 주세요.", "REQUIRED_FIELD");
  }
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new ShuttleContractError(`${label} 값을 확인해 주세요.`, "INVALID_INTEGER");
  }
  return value as number;
}

function coordinate(value: unknown, axis: "latitude" | "longitude", required = true): number | undefined {
  if (value === undefined || value === null || value === "") {
    if (!required) return undefined;
    throw new ShuttleContractError("지도 좌표를 확인해 주세요.", "COORDINATES_REQUIRED");
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ShuttleContractError("지도 좌표를 확인해 주세요.", "INVALID_COORDINATES");
  }
  const [minimum, maximum] = axis === "latitude" ? [-90, 90] : [-180, 180];
  if (value < minimum || value > maximum) {
    throw new ShuttleContractError("지도 좌표 범위를 확인해 주세요.", "INVALID_COORDINATES");
  }
  return value;
}

function isoDate(value: unknown, label: string, dateOnly = false): string | undefined {
  const normalized = text(value, 40);
  if (!normalized) return undefined;
  if (dateOnly && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new ShuttleContractError(`${label} 형식을 확인해 주세요.`, "INVALID_DATE");
  }
  const parsed = new Date(dateOnly ? `${normalized}T00:00:00.000Z` : normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new ShuttleContractError(`${label} 형식을 확인해 주세요.`, "INVALID_DATE");
  }
  return dateOnly ? normalized : parsed.toISOString();
}

function parseEndpoint(value: unknown): ShuttleEndpointInput | undefined {
  if (value === undefined || value === null) return undefined;
  const body = record(value);
  const latitude = coordinate(body.latitude, "latitude", false);
  const longitude = coordinate(body.longitude, "longitude", false);
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new ShuttleContractError("출발·도착 좌표는 위도와 경도를 함께 입력해 주세요.", "INCOMPLETE_COORDINATES");
  }
  const endpoint = {
    name: text(body.name, 120),
    address: text(body.address, 300),
    latitude,
    longitude,
  };
  return Object.values(endpoint).some((item) => item !== undefined) ? endpoint : undefined;
}

export function parseShuttleVehicleInput(value: unknown): ShuttleVehicleInput {
  const body = record(value);
  return {
    name: text(body.name, 120, true)!,
    plateNumber: text(body.plateNumber, 40),
    capacity: integer(body.capacity, "차량 정원", 1),
    isActive: body.isActive === undefined ? true : body.isActive === true,
    notes: text(body.notes, 1000),
  };
}

export function parseShuttleRoutePlanInput(value: unknown): ShuttleRoutePlanInput {
  const body = record(value);
  const direction = text(body.direction, 20);
  if (!SHUTTLE_ROUTE_DIRECTIONS.includes(direction as ShuttleRouteDirection)) {
    throw new ShuttleContractError("등원·하원 구분을 확인해 주세요.", "INVALID_DIRECTION");
  }
  const routeKey = text(body.routeKey, 120) ?? crypto.randomUUID();
  return {
    seasonId: text(body.seasonId, 100, true)!,
    vehicleId: text(body.vehicleId, 100),
    routeKey,
    name: text(body.name, 120, true)!,
    direction: direction as ShuttleRouteDirection,
    serviceDate: isoDate(body.serviceDate, "운행일", true),
    origin: parseEndpoint(body.origin),
    destination: parseEndpoint(body.destination),
  };
}

export function parseShuttleRouteStopInput(value: unknown): ShuttleRouteStopInput {
  const body = record(value);
  return {
    stopOrder: integer(body.stopOrder, "정류장 순서", 1),
    name: text(body.name, 120, true)!,
    address: text(body.address, 300, true)!,
    roadAddress: text(body.roadAddress, 300),
    latitude: coordinate(body.latitude, "latitude")!,
    longitude: coordinate(body.longitude, "longitude")!,
    plannedAt: isoDate(body.plannedAt, "예정 시각"),
    note: text(body.note, 1000),
  };
}

export function parseShuttleRoutePassengerInput(value: unknown): ShuttleRoutePassengerInput {
  const body = record(value);
  const phone = text(body.parentPhoneSnapshot, 30)?.replace(/[^0-9]/g, "");
  if (phone && (phone.length < 10 || phone.length > 11)) {
    throw new ShuttleContractError("학부모 연락처를 확인해 주세요.", "INVALID_PHONE");
  }
  return {
    stopId: text(body.stopId, 100, true)!,
    shuttleRequestId: text(body.shuttleRequestId, 100, true)!,
    studentNameSnapshot: text(body.studentNameSnapshot, 80, true)!,
    parentNameSnapshot: text(body.parentNameSnapshot, 80),
    parentPhoneSnapshot: phone,
    note: text(body.note, 1000),
  };
}

export function assertShuttleCapacity(capacity: number, passengerCount: number): void {
  if (!Number.isInteger(capacity) || capacity < 1 || passengerCount > capacity) {
    throw new ShuttleContractError("차량 정원을 초과해 학생을 배정할 수 없습니다.", "VEHICLE_CAPACITY_EXCEEDED", 409);
  }
}

export function assertUniqueStopOrders(stops: ReadonlyArray<{ stopOrder: number }>): void {
  const orders = new Set<number>();
  for (const stop of stops) {
    if (!Number.isInteger(stop.stopOrder) || stop.stopOrder < 1 || orders.has(stop.stopOrder)) {
      throw new ShuttleContractError("정류장 순서가 중복되었거나 올바르지 않습니다.", "DUPLICATE_STOP_ORDER", 409);
    }
    orders.add(stop.stopOrder);
  }
}

export function assertUniquePassengers(
  passengers: ReadonlyArray<{ shuttleRequestId: string }>,
): void {
  const requestIds = new Set<string>();
  for (const passenger of passengers) {
    if (!passenger.shuttleRequestId || requestIds.has(passenger.shuttleRequestId)) {
      throw new ShuttleContractError("같은 학생을 한 노선에 중복 배정할 수 없습니다.", "DUPLICATE_PASSENGER", 409);
    }
    requestIds.add(passenger.shuttleRequestId);
  }
}
