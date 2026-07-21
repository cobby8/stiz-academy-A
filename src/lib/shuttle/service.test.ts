import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error Node 내장 테스트 러너는 TypeScript 확장자 import를 실행할 수 있다.
import { parseShuttleRoutePlanInput, ShuttleContractError } from "./contracts.ts";

const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/api/admin/shuttle/route.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../prisma/migrations/20260721223000_add_shuttle_route_planning/migration.sql", import.meta.url),
  "utf8",
);

test("방향 계약은 등원과 하원만 허용한다", () => {
  const base = { seasonId: "season-1", name: "A 노선" };
  assert.equal(parseShuttleRoutePlanInput({ ...base, direction: "PICKUP" }).direction, "PICKUP");
  assert.equal(parseShuttleRoutePlanInput({ ...base, direction: "DROPOFF" }).direction, "DROPOFF");
  assert.throws(
    () => parseShuttleRoutePlanInput({ ...base, direction: "SIDEWAYS" }),
    (error) => error instanceof ShuttleContractError && error.code === "INVALID_DIRECTION",
  );
});

test("관리자 API는 모든 진입점에서 관리자 인증을 먼저 확인한다", () => {
  assert.equal((route.match(/await requireAdmin\(\)/g) ?? []).length, 3);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function PATCH/);
});

test("노선 변경 API는 허용한 작업만 명시적으로 분기한다", () => {
  for (const action of ["update", "assign", "unassign", "reorder", "confirm", "complete", "archive", "revise"]) {
    assert.match(route, new RegExp(`case "${action}"`));
  }
  assert.match(route, /body\.resource === "shuttleRequest"/);
  assert.match(route, /confirmLocation/);
  assert.match(route, /UNSUPPORTED_ACTION/);
  assert.match(route, /UNSUPPORTED_RESOURCE/);
});

test("관리자는 지도 핀으로 셔틀 신청 위치를 직접 확정한다", () => {
  assert.match(service, /export async function updateShuttleRequestLocation/);
  assert.match(service, /parseLocationKind/);
  assert.match(service, /pickupConfirmedAt: new Date\(\)/);
  assert.match(service, /dropoffConfirmedAt: new Date\(\)/);
  assert.match(service, /SHUTTLE_LOCATION_CONSENT_VERSION/);
  assert.match(service, /locationConsentVersion: SHUTTLE_LOCATION_CONSENT_VERSION/);
  assert.match(service, /SHUTTLE_LOCATION_CONFIRMED/);
  assert.match(route, /updateShuttleRequestLocation\(actor, id, data\)/);
});

test("학생 배정은 위치 확인, 중복 배정, 차량 정원을 모두 검사한다", () => {
  assert.match(service, /LOCATION_NOT_CONFIRMED/);
  assert.match(service, /DUPLICATE_ASSIGNMENT/);
  assert.match(service, /VEHICLE_CAPACITY_EXCEEDED/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
});

test("확정 노선은 잠그고 수정할 때 새 버전을 만든다", () => {
  assert.match(service, /ROUTE_LOCKED/);
  assert.match(service, /ROUTE_REVISION_CREATED/);
  assert.match(service, /version: \(latest\._max\.version \?\? source\.version\) \+ 1/);
  assert.match(service, /previousVersionId: source\.id/);
});

test("배정 포인터는 다른 활성 노선을 확인한 뒤 재동기화한다", () => {
  assert.match(service, /async function syncLegacyAssignment/);
  assert.match(service, /status: \{ not: ShuttleRoutePlanStatus\.ARCHIVED \}/);
  assert.match(service, /currentRequestIds/);
});

test("동시 수정 충돌은 재시도 가능한 409 응답으로 변환한다", () => {
  assert.match(route, /P2034/);
  assert.match(route, /P2002/);
  assert.match(route, /SHUTTLE_CONCURRENT_UPDATE/);
});

test("지도 위치 저장 제약 오류는 관리자에게 원인을 알 수 있는 응답으로 변환한다", () => {
  assert.match(route, /P2004/);
  assert.match(route, /map_metadata_check/);
  assert.match(route, /SHUTTLE_LOCATION_METADATA_REQUIRED/);
});

test("정류장 순서를 바꾸는 중에도 DB의 양수 제약을 지킨다", () => {
  assert.match(migration, /ShuttleRouteStop_order_check[\s\S]*"stopOrder" > 0/);
  assert.match(service, /temporaryOffset \+ index \+ 1/);
  assert.doesNotMatch(service, /stopOrder:\s*-\(index \+ 1\)/);
});

test("차량과 노선 수정도 직렬화 트랜잭션으로 동시 변경을 감지한다", () => {
  const updateVehicle = service.slice(service.indexOf("export async function updateVehicle"), service.indexOf("export async function createRoute"));
  const updateRoute = service.slice(service.indexOf("export async function updateRoute"), service.indexOf("export async function assignPassenger"));
  assert.match(updateVehicle, /TransactionIsolationLevel\.Serializable/);
  assert.match(updateRoute, /TransactionIsolationLevel\.Serializable/);
});

test("노선 및 배정 변경은 감사 로그로 남긴다", () => {
  for (const action of ["VEHICLE_CREATED", "ROUTE_CREATED", "SHUTTLE_LOCATION_CONFIRMED", "PASSENGER_ASSIGNED", "PASSENGER_UNASSIGNED", "STOPS_REORDERED", "ROUTE_CONFIRMED", "ROUTE_ARCHIVED"]) {
    assert.match(service, new RegExp(`"${action}"`));
  }
});
