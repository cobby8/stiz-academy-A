import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaSource = await readFile("prisma/schema.prisma", "utf8");
const migrationSource = await readFile("prisma/migrations/20260721234500_add_shuttle_route_driver/migration.sql", "utf8");
const serviceSource = await readFile("src/lib/shuttle/service.ts", "utf8");
const adminClientSource = await readFile("src/app/admin/shuttle/ShuttleRouteAdminClient.tsx", "utf8");
const staffShuttleSource = await readFile("src/app/staff/shuttle/page.tsx", "utf8");

test("shuttle routes can be assigned to DRIVER users", () => {
  assert.match(schemaSource, /driverUserId String\?/);
  assert.match(schemaSource, /driver User\? @relation\("ShuttleRouteDriver"/);
  assert.match(schemaSource, /drivenShuttleRoutePlans ShuttleRoutePlan\[\] @relation\("ShuttleRouteDriver"\)/);
  assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS "driverUserId" TEXT/);
  assert.match(migrationSource, /"ShuttleRoutePlan_driverUserId_fkey"/);
});

test("server validates driver assignment and requires it before confirmation", () => {
  assert.match(serviceSource, /async function ensureDriver/);
  assert.match(serviceSource, /role: "DRIVER"/);
  assert.match(serviceSource, /DRIVER_UNAVAILABLE/);
  assert.match(serviceSource, /DRIVER_REQUIRED/);
  assert.match(serviceSource, /driverUserId: source\.driverUserId/);
});

test("admin shuttle UI sends and edits driver assignments", () => {
  assert.match(adminClientSource, /interface Driver/);
  assert.match(adminClientSource, /body\.drivers \?\? \[\]/);
  assert.match(adminClientSource, /driverUserId: values\.driverUserId/);
  assert.match(adminClientSource, /담당 기사/);
  assert.match(adminClientSource, /!selectedRoute\.driverUserId/);
});

test("staff shuttle page shows assigned confirmed routes", () => {
  assert.match(staffShuttleSource, /getStaffShuttleDashboard\(staff\)/);
  assert.match(serviceSource, /export async function getStaffShuttleDashboard/);
  assert.match(serviceSource, /status: ShuttleRoutePlanStatus\.CONFIRMED/);
  assert.match(serviceSource, /driverUserId: actor\.appUserId/);
});
