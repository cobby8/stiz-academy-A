import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error -- Node's type-stripping runner needs the runtime extension.
import * as shuttleContracts from "./contracts.ts";

const {
  assertShuttleCapacity,
  assertUniquePassengers,
  assertUniqueStopOrders,
  parseShuttleRoutePassengerInput,
  parseShuttleRoutePlanInput,
  parseShuttleRouteStopInput,
  parseShuttleVehicleInput,
  ShuttleContractError,
} = shuttleContracts;

test("차량 입력을 정규화하고 정원은 양수만 허용한다", () => {
  assert.deepEqual(parseShuttleVehicleInput({ name: "  1호차 ", capacity: 12 }), {
    name: "1호차",
    plateNumber: undefined,
    capacity: 12,
    isActive: true,
    notes: undefined,
  });
  assert.throws(
    () => parseShuttleVehicleInput({ name: "1호차", capacity: 0 }),
    (error: unknown) => error instanceof ShuttleContractError && error.code === "INVALID_INTEGER",
  );
});

test("노선은 방향과 날짜 및 좌표 쌍을 검증한다", () => {
  const route = parseShuttleRoutePlanInput({
    seasonId: "season-1",
    routeKey: "morning-a",
    name: "오전 A노선",
    direction: "PICKUP",
    serviceDate: "2026-07-27",
    destination: { name: "학원", latitude: 37.5, longitude: 127.1 },
  });
  assert.equal(route.direction, "PICKUP");
  assert.equal(route.serviceDate, "2026-07-27");
  assert.throws(
    () => parseShuttleRoutePlanInput({
      seasonId: "season-1",
      name: "잘못된 노선",
      direction: "ROUND_TRIP",
    }),
    (error: unknown) => error instanceof ShuttleContractError && error.code === "INVALID_DIRECTION",
  );
  assert.throws(
    () => parseShuttleRoutePlanInput({
      seasonId: "season-1",
      name: "좌표 누락",
      direction: "DROPOFF",
      origin: { latitude: 37.5 },
    }),
    (error: unknown) => error instanceof ShuttleContractError && error.code === "INCOMPLETE_COORDINATES",
  );
});

test("정류장 좌표 범위와 예정 시각을 검증한다", () => {
  const stop = parseShuttleRouteStopInput({
    stopOrder: 1,
    name: "중앙공원 입구",
    address: "서울시 테스트구 1",
    latitude: 37.55,
    longitude: 126.99,
    plannedAt: "2026-07-27T08:10:00+09:00",
  });
  assert.equal(stop.plannedAt, "2026-07-26T23:10:00.000Z");
  assert.throws(
    () => parseShuttleRouteStopInput({
      stopOrder: 1,
      name: "오류",
      address: "주소",
      latitude: 91,
      longitude: 127,
    }),
    (error: unknown) => error instanceof ShuttleContractError && error.code === "INVALID_COORDINATES",
  );
});

test("탑승자 스냅샷 연락처를 숫자로 정규화한다", () => {
  const passenger = parseShuttleRoutePassengerInput({
    stopId: "stop-1",
    shuttleRequestId: "request-1",
    studentNameSnapshot: "김학생",
    parentPhoneSnapshot: "010-1234-5678",
  });
  assert.equal(passenger.parentPhoneSnapshot, "01012345678");
});

test("정원, 정류장 순서, 탑승자 중복을 차단한다", () => {
  assert.doesNotThrow(() => assertShuttleCapacity(12, 12));
  assert.throws(
    () => assertShuttleCapacity(12, 13),
    (error: unknown) => error instanceof ShuttleContractError && error.code === "VEHICLE_CAPACITY_EXCEEDED",
  );
  assert.throws(
    () => assertUniqueStopOrders([{ stopOrder: 1 }, { stopOrder: 1 }]),
    (error: unknown) => error instanceof ShuttleContractError && error.code === "DUPLICATE_STOP_ORDER",
  );
  assert.throws(
    () => assertUniquePassengers([{ shuttleRequestId: "request-1" }, { shuttleRequestId: "request-1" }]),
    (error: unknown) => error instanceof ShuttleContractError && error.code === "DUPLICATE_PASSENGER",
  );
});
