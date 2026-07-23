import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const helper = readFileSync(
  new URL("../src/lib/enrollment-account-handoff.ts", import.meta.url),
  "utf8",
);
const complete = readFileSync(
  new URL("../src/lib/parent-signup-verification.ts", import.meta.url),
  "utf8",
);
const connectRoute = readFileSync(
  new URL("../src/app/api/auth/enrollment-handoff/connect/route.ts", import.meta.url),
  "utf8",
);
const oauthStart = readFileSync(
  new URL("../src/app/auth/oauth/[provider]/route.ts", import.meta.url),
  "utf8",
);
const oauthCallback = readFileSync(
  new URL("../src/app/auth/callback/route.ts", import.meta.url),
  "utf8",
);
const loginAction = readFileSync(
  new URL("../src/app/actions/auth.ts", import.meta.url),
  "utf8",
);
const loginPage = readFileSync(
  new URL("../src/app/login/page.tsx", import.meta.url),
  "utf8",
);
const enrollAction = readFileSync(
  new URL("../src/app/actions/public.ts", import.meta.url),
  "utf8",
);
const enrollForm = readFileSync(
  new URL("../src/app/apply/enroll/EnrollApplicationForm.tsx", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../prisma/migrations/20260724020000_link_enrollment_parent_account/migration.sql", import.meta.url),
  "utf8",
);

test("handoff stores only token and phone hashes with a short expiry", () => {
  assert.match(helper, /"tokenHash"/);
  assert.match(helper, /"phoneHash"/);
  assert.match(helper, /HANDOFF_TTL_HOURS = 2/);
  assert.doesNotMatch(helper, /INSERT INTO "EnrollmentAccountHandoff"[\s\S]*\btoken\b[\s\S]*VALUES/);
});

test("link requires a verified parent and exact application phone match", () => {
  assert.match(helper, /row\.role !== "PARENT" \|\| !row\.phoneVerifiedAt/);
  assert.match(helper, /userPhone !== applicationPhone/);
  assert.match(helper, /"parentUserId" = \$2/);
  assert.match(helper, /이미 다른 학부모 계정과 연결된 수강신청/);
});

test("new signup links inside the application transaction", () => {
  assert.match(complete, /await linkEnrollmentAccount\([\s\S]*tx,/);
});

test("existing login trusts the STIZ user table instead of user metadata", () => {
  assert.match(connectRoute, /role = 'PARENT' AND "phoneVerifiedAt" IS NOT NULL/);
  assert.doesNotMatch(connectRoute, /user_metadata/);
});

test("OAuth round trip preserves enrollment handoff", () => {
  assert.match(oauthStart, /callbackUrl\.searchParams\.set\("handoff"/);
  assert.match(oauthStart, /url\.searchParams\.set\("enrollmentHandoff"/);
  assert.match(oauthCallback, /url\.searchParams\.set\("enrollmentHandoff"/);
});

test("existing password and OAuth login link before entering the parent page", () => {
  assert.match(loginPage, /formData\.set\("enrollmentHandoff", handoff\)/);
  assert.match(loginAction, /await linkEnrollmentAccount\(/);
  assert.match(loginAction, /destination = "\/parent"/);
  assert.match(oauthCallback, /await linkEnrollmentAccount\(/);
  assert.match(oauthCallback, /enrollmentHandoff \? "\/parent" : next/);
});

test("signup CTA keeps the handoff and opens the parent signup screen", () => {
  assert.match(enrollAction, /next: "\/signup\/parent"/);
  assert.match(enrollForm, /enrollmentHandoff: accountHandoff\.token/);
  assert.match(loginPage, /get\("handoff"\) \|\| searchParams\.get\("enrollmentHandoff"\)/);
});

test("handoff failure cannot turn an accepted application into a failed submission", () => {
  assert.match(enrollAction, /issueEnrollmentAccountHandoffSafely/);
  assert.match(enrollAction, /catch \(error\)[\s\S]*return null/);
  assert.match(enrollAction, /accountHandoff: handoff \?/);
});

test("handoff table is server-only", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL[\s\S]*anon, authenticated/);
});
