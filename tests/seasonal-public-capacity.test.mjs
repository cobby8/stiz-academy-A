import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const service = readFileSync("src/lib/seasonal/service.ts", "utf8");
const planning = readFileSync("src/lib/seasonal/planning.ts", "utf8");
const types = readFileSync("src/components/seasonal/types.ts", "utf8");
const detail = readFileSync("src/components/seasonal/SeasonalDetailClient.tsx", "utf8");
const apply = readFileSync("src/components/seasonal/SeasonalApplyClient.tsx", "utf8");
const list = readFileSync("src/components/seasonal/SeasonalListClient.tsx", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260722153000_allow_open_null_capacity/migration.sql",
  "utf8",
);

test("public seasonal pages hide open offerings until capacity is confirmed", () => {
  assert.match(service, /capacity: \{ not: null \}/);
  assert.doesNotMatch(service, /offering\.capacity === null/);
  assert.doesNotMatch(service, /capacity: byId\.get/);
  assert.match(service, /const remaining = capacity === null \? null/);
  assert.match(service, /waitlistEnabled: capacity !== null/);
});

test("seasonal planning and public UI still handle unspecified capacity defensively", () => {
  assert.match(planning, /capacity: number \| null/);
  assert.match(planning, /offering\.capacity !== null &&/);
  assert.match(types, /remaining: number \| null/);
  assert.match(detail, /item\.capacity === null/);
  assert.match(apply, /function isFull\(item: SeasonalClass\)/);
  assert.match(apply, /function remainingText\(item: SeasonalClass\)/);
  assert.match(list, /hasOpenCapacity/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS "SpecialProgramOffering_open_capacity_check"/);
});
