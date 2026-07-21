import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SHUTTLE_ROUTE_TABLES = [
  "ShuttleVehicle",
  "ShuttleRoutePlan",
  "ShuttleRouteStop",
  "ShuttleRoutePassenger",
  "ShuttleAuditLog",
];

const migration = readFileSync(
  new URL("../prisma/migrations/20260721223000_add_shuttle_route_planning/migration.sql", import.meta.url),
  "utf8",
);

test("셔틀 노선 관리 테이블은 모두 RLS와 Data API 직접 접근 차단을 적용한다", () => {
  assert.equal(SHUTTLE_ROUTE_TABLES.length, 5);
  for (const table of SHUTTLE_ROUTE_TABLES) {
    assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`));
    assert.match(migration, new RegExp(`REVOKE ALL ON TABLE "${table}" FROM anon, authenticated;`));
  }
});

test("기존 자유 입력 배정 ID에는 운영 데이터 호환을 깨는 외래키를 추가하지 않는다", () => {
  assert.doesNotMatch(
    migration,
    /SpecialProgramShuttleRequest_(?:assignedRouteId|assignedStopId)_fkey/,
  );
});
