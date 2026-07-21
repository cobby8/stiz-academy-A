import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaSource = await readFile("prisma/schema.prisma", "utf8");
const migrationSource = await readFile("prisma/migrations/20260722001000_add_shuttle_passenger_ride_status/migration.sql", "utf8");
const completionMigrationSource = await readFile("prisma/migrations/20260722093000_add_shuttle_route_completion/migration.sql", "utf8");
const completionColumnsMigrationSource = await readFile("prisma/migrations/20260722094000_add_shuttle_route_completion_columns/migration.sql", "utf8");
const serviceSource = await readFile("src/lib/shuttle/service.ts", "utf8");
const apiSource = await readFile("src/app/api/staff/shuttle/route.ts", "utf8");
const adminApiSource = await readFile("src/app/api/admin/shuttle/route.ts", "utf8");
const staffPageSource = await readFile("src/app/staff/shuttle/page.tsx", "utf8");
const staffDashboardClientSource = await readFile("src/app/staff/shuttle/StaffShuttleDashboardClient.tsx", "utf8");
const staffButtonsSource = await readFile("src/app/staff/shuttle/ShuttleRideStatusButtons.tsx", "utf8");
const adminClientSource = await readFile("src/app/admin/shuttle/ShuttleRouteAdminClient.tsx", "utf8");

test("shuttle passengers keep live ride status", () => {
  assert.match(schemaSource, /rideStatus String @default\("PENDING"\)/);
  assert.match(schemaSource, /rideStatusUpdatedAt DateTime\? @db\.Timestamptz\(6\)/);
  assert.match(schemaSource, /@@index\(\[routePlanId, rideStatus\]\)/);
  assert.match(migrationSource, /"rideStatus" TEXT NOT NULL DEFAULT 'PENDING'/);
  assert.match(migrationSource, /CHECK \("rideStatus" IN \('PENDING', 'BOARDED', 'DROPPED_OFF', 'NO_SHOW'\)\)/);
});

test("staff API validates and saves passenger ride status", () => {
  assert.match(serviceSource, /export async function updatePassengerRideStatus/);
  assert.match(serviceSource, /DRIVER_ROUTE_FORBIDDEN/);
  assert.match(serviceSource, /PASSENGER_RIDE_STATUS_UPDATED/);
  assert.match(apiSource, /export async function PATCH/);
  assert.match(apiSource, /updatePassengerRideStatus\(staff, routeId, passengerId, body\.status\)/);
});

test("driver shuttle page can check passengers and update summary immediately", () => {
  assert.match(staffPageSource, /StaffShuttleDashboardClient/);
  assert.match(staffDashboardClientSource, /ShuttleRideStatusButtons/);
  assert.match(staffDashboardClientSource, /RideStatusPill/);
  assert.match(staffDashboardClientSource, /셔틀 기사 앱/);
  assert.match(staffDashboardClientSource, /체크 대기/);
  assert.match(staffDashboardClientSource, /체크 완료/);
  assert.match(staffDashboardClientSource, /summarizeRideStatuses/);
  assert.match(staffDashboardClientSource, /handleStatusChange\(passenger\.id, status\)/);
  assert.match(staffButtonsSource, /fetch\("\/api\/staff\/shuttle"/);
  assert.match(staffButtonsSource, /onStatusChange\(nextStatus\)/);
  assert.match(staffButtonsSource, /onStatusChange\(previous\)/);
  assert.match(staffButtonsSource, /저장 중/);
  assert.match(staffButtonsSource, /저장 완료/);
  assert.match(staffButtonsSource, /BOARDED/);
  assert.match(staffButtonsSource, /DROPPED_OFF/);
  assert.match(staffButtonsSource, /NO_SHOW/);
});

test("admin route screen shows ride status for each passenger", () => {
  assert.match(adminClientSource, /rideStatus\?: string \| null/);
  assert.match(adminClientSource, /rideStatusLabel\(passenger\.rideStatus\)/);
  assert.match(adminClientSource, /function rideStatusClass/);
  assert.match(adminClientSource, /summarizeRideStatuses\(stops\)/);
  assert.match(adminClientSource, /체크 대기/);
  assert.match(adminClientSource, /미탑승/);
});

test("confirmed routes can be completed only after every passenger is checked", () => {
  assert.match(schemaSource, /completedAt DateTime\? @db\.Timestamptz\(6\)/);
  assert.match(schemaSource, /COMPLETED/);
  assert.match(completionMigrationSource, /ADD VALUE IF NOT EXISTS 'COMPLETED'/);
  assert.match(completionColumnsMigrationSource, /"completedAt" TIMESTAMPTZ\(6\)/);
  assert.match(completionColumnsMigrationSource, /ShuttleRoutePlan_completion_check/);
  assert.match(serviceSource, /export async function completeRoute/);
  assert.match(serviceSource, /RIDE_STATUS_PENDING/);
  assert.match(serviceSource, /ROUTE_COMPLETED/);
  assert.match(adminApiSource, /case "complete"/);
  assert.match(adminClientSource, /action: "complete"/);
  assert.match(adminClientSource, /운행 완료/);
  assert.match(adminClientSource, /체크 대기 학생을 모두/);
});

test("admin shuttle screen refreshes live driver check status", () => {
  assert.match(adminClientSource, /autoRefresh/);
  assert.match(adminClientSource, /window\.setInterval/);
  assert.match(adminClientSource, /30000/);
  assert.match(adminClientSource, /새 상태 불러오기/);
  assert.match(adminClientSource, /30초 자동 새로고침/);
});

test("shuttle user-facing files keep Korean text readable", () => {
  for (const source of [adminClientSource, adminApiSource, staffDashboardClientSource, staffButtonsSource]) {
    assert.doesNotMatch(source, /�|泥|湲곗|誘명|뷀|댄뻾|곹깭/);
  }
});
