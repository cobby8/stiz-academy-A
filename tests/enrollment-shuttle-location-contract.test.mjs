import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const publicAction = fs.readFileSync("src/app/actions/public.ts", "utf8");
const adminAction = fs.readFileSync("src/app/actions/admin.ts", "utf8");
const migration = fs.readFileSync(
  "prisma/migrations/20260724050000_add_enrollment_shuttle_locations/migration.sql",
  "utf8",
);

test("regular enrollment requires both map locations and current consent", () => {
  assert.match(publicAction, /normalizeEnrollmentShuttleLocation\(data\.shuttlePickupLocationData/);
  assert.match(publicAction, /normalizeEnrollmentShuttleLocation\(data\.shuttleDropoffLocationData/);
  assert.match(publicAction, /data\.shuttleLocationConsent !== true/);
  assert.match(publicAction, /data\.shuttleLocationConsentVersion !== SHUTTLE_LOCATION_CONSENT_VERSION/);
});

test("disabling shuttle clears every location and consent field", () => {
  assert.match(publicAction, /data\.shuttleNeeded\s*\?\s*normalizeEnrollmentShuttleLocation/);
  assert.match(publicAction, /const shuttleLocationConsentVersion = data\.shuttleNeeded \? SHUTTLE_LOCATION_CONSENT_VERSION : null/);
  assert.match(publicAction, /const shuttleLocationConsentAt = data\.shuttleNeeded \? new Date\(\) : null/);
  assert.match(publicAction, /"shuttlePickupAddress" = \$27/);
  assert.match(publicAction, /"shuttleDropoffAddress" = \$35/);
});

test("database rejects partial, invalid, and unconsented map metadata", () => {
  assert.match(migration, /shuttle_pickup_coordinate_check/);
  assert.match(migration, /"shuttlePickupLatitude" BETWEEN -90 AND 90/);
  assert.match(migration, /"shuttlePickupSource" IN \('MAP_PIN', 'SEARCH', 'CURRENT_LOCATION'\)/);
  assert.match(migration, /shuttle_location_consent_check/);
  assert.match(migration, /shuttle_location_complete_check/);
  assert.match(migration, /COALESCE\("shuttleNeeded", false\) = false[\s\S]*ROW\([\s\S]*\) IS NULL/);
  assert.match(migration, /COALESCE\("shuttleNeeded", false\) = true[\s\S]*ROW\([\s\S]*\) IS NULL[\s\S]*OR \(/);
});

test("approval copies both confirmed locations atomically to the student", () => {
  assert.match(adminAction, /await prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(adminAction, /SELECT \* FROM "EnrollmentApplication" WHERE id = \$1 FOR UPDATE/);
  assert.match(adminAction, /INSERT INTO "StudentShuttleLocation"/);
  assert.match(adminAction, /ON CONFLICT \("studentId", kind\) DO UPDATE/);
  assert.match(adminAction, /SHUTTLE_LOCATION_CONSENT_VERSION/);
  assert.doesNotMatch(adminAction, /ConfirmedAt.*\?\? new Date\(\)/);
  assert.match(adminAction, /upsertLocation\("PICKUP", "shuttlePickup"\)/);
  assert.match(adminAction, /upsertLocation\("DROPOFF", "shuttleDropoff"\)/);
});

test("approval validates raw coordinates and inserts guardian without abort-prone conflict handling", () => {
  assert.match(adminAction, /rawLatitude != null/);
  assert.match(adminAction, /rawLongitude != null/);
  assert.match(adminAction, /INSERT INTO "Guardian"[\s\S]*SELECT gen_random_uuid\(\)::text[\s\S]*WHERE NOT EXISTS/);
  assert.doesNotMatch(adminAction, /ON CONFLICT \("studentId"\) WHERE relation = \$2 DO NOTHING/);
});
