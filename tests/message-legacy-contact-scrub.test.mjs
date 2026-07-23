import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../prisma/migrations/20260724040000_scrub_legacy_notification_contacts/migration.sql", import.meta.url),
  "utf8",
);

test("legacy notification contacts keep only the last four digits", () => {
  assert.match(migration, /"recipientPhoneLast4"\s*=\s*COALESCE/);
  assert.match(migration, /"recipientPhone"\s*=\s*NULL/);
  assert.match(migration, /"payloadJSON"\s*-[\s\S]*'recipientPhone'/);
  assert.match(migration, /MessageDeliveryBatch_manual_stableEventKey_key/);
  assert.doesNotMatch(migration, /"recipientPhoneHash"\s*=/);
});
