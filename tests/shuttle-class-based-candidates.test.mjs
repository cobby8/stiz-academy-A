import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile("prisma/schema.prisma", "utf8");
const migration = await readFile("prisma/migrations/20260722143000_add_student_shuttle_locations/migration.sql", "utf8");
const service = await readFile("src/lib/shuttle/service.ts", "utf8");
const route = await readFile("src/app/api/admin/shuttle/route.ts", "utf8");
const adminClient = await readFile("src/app/admin/shuttle/ShuttleRouteAdminClient.tsx", "utf8");

test("student shuttle locations are stored separately for pickup and dropoff", () => {
  assert.match(schema, /model StudentShuttleLocation/);
  assert.match(schema, /shuttleLocations\s+StudentShuttleLocation\[\]/);
  assert.match(schema, /@@unique\(\[studentId, kind\]\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "StudentShuttleLocation"/);
  assert.match(migration, /CHECK \(kind IN \('PICKUP', 'DROPOFF'\)\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
});

test("admin API can save student pickup and dropoff locations", () => {
  assert.match(service, /export async function updateStudentShuttleLocation/);
  assert.match(service, /ON CONFLICT \("studentId", kind\) DO UPDATE/);
  assert.match(service, /SHUTTLE_LOCATION_CONSENT_VERSION/);
  assert.match(route, /resource === "studentLocation"/);
  assert.match(route, /updateStudentShuttleLocation\(actor, id, data\)/);
});

test("class based shuttle candidates are derived from sessions and enrollments", () => {
  assert.match(service, /export async function getClassBasedShuttleCandidates/);
  assert.match(service, /JOIN "Enrollment" e ON e\."classId" = c\.id AND e\.status = 'ACTIVE'/);
  assert.match(service, /LEFT JOIN "StudentShuttleLocation" pickup/);
  assert.match(service, /classBasedCandidates/);
});

test("admin UI shows class based candidates and per-student location buttons", () => {
  assert.match(adminClient, /ClassCandidatePanel/);
  assert.match(adminClient, /수업 기반 자동 후보/);
  assert.match(adminClient, /resource: "studentLocation"/);
  assert.match(adminClient, /onPickLocation\(student, "pickup"\)/);
  assert.match(adminClient, /onPickLocation\(student, "dropoff"\)/);
});
