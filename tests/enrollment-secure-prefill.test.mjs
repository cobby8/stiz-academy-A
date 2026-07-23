import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/apply/enroll/page.tsx", "utf8");
const actions = readFileSync("src/app/actions/public.ts", "utf8");
const form = readFileSync("src/app/apply/enroll/EnrollApplicationForm.tsx", "utf8");

test("enrollment prefill requires a live opaque access code", () => {
  assert.match(page, /params\.access/);
  assert.doesNotMatch(page, /params\.trialId/);
  assert.match(page, /getTrialLeadForEnrollByAccessCode\(accessCode\)/);
  assert.match(actions, /export async function getTrialLeadForEnrollByAccessCode/);
  assert.match(actions, /l\."isActive" = true/);
  assert.match(actions, /l\."expiresAt" > NOW\(\)/);
});

test("confirmed class slot takes priority over the original preferred slot", () => {
  assert.match(actions, /COALESCE\(c\."slotKey", t\."preferredSlotKey"\)/);
  assert.match(actions, /LEFT JOIN "Class" c ON c\.id = t\."scheduledClassId"/);
});

test("the browser submits the access code instead of an internal trial ID", () => {
  assert.match(form, /accessCode:\s*accessCode \|\| undefined/);
  assert.doesNotMatch(form, /trialLeadId:\s*trialLeadId \|\| undefined/);
  assert.match(actions, /resolveTrialLeadIdFromEnrollmentAccess\(data\.accessCode\)/);
});
