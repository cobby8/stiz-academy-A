import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260724010000_add_enrollment_short_links/migration.sql",
  "utf8",
);
const helper = readFileSync("src/lib/enroll-short-link.ts", "utf8");
const route = readFileSync("src/app/e/[code]/route.ts", "utf8");

test("short enrollment links use an opaque 96-bit code and expire", () => {
  assert.match(schema, /model EnrollmentShortLink/);
  assert.match(schema, /code\s+String\s+@unique/);
  assert.match(schema, /expiresAt\s+DateTime/);
  assert.match(schema, /isActive\s+Boolean\s+@default\(true\)/);
  assert.match(helper, /randomBytes\(CODE_BYTES\)\.toString\("base64url"\)/);
  assert.match(helper, /const CODE_BYTES = 12/);
  assert.match(helper, /"expiresAt" > NOW\(\)/);
  assert.match(helper, /"isActive" = true/);
  assert.match(helper, /export async function createTrialEnrollShortLink/);
  assert.match(helper, /shortUrl: link\.url/);
});

test("SMS short URL hides the trial ID and keeps the opaque access code", () => {
  assert.match(
    helper,
    /process\.env\.SHORT_LINK_BASE_URL[\s\S]*?process\.env\.NEXT_PUBLIC_SITE_URL/,
  );
  assert.match(helper, /\/e\/\$\{code\}/);
  assert.doesNotMatch(helper, /trialId=\$\{/);
  assert.match(route, /searchParams\.set\("access", shortLink\.code\)/);
  assert.doesNotMatch(route, /searchParams\.set\("trialId"/);
});

test("database protects the link table from public roles", () => {
  assert.match(migration, /FOREIGN KEY \("trialLeadId"\)/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE "EnrollmentShortLink" FROM anon, authenticated/);
  assert.match(migration, /CHECK \("code" ~ '\^\[A-Za-z0-9_-\]\{16\}\$'\)/);
});
