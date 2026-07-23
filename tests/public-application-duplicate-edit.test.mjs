import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicAction = readFileSync(new URL("../src/app/actions/public.ts", import.meta.url), "utf8");
const trialForm = readFileSync(new URL("../src/app/apply/trial/TrialApplicationForm.tsx", import.meta.url), "utf8");
const enrollForm = readFileSync(new URL("../src/app/apply/enroll/EnrollApplicationForm.tsx", import.meta.url), "utf8");

test("공개 체험 신청은 같은 학생·연락처의 진행 중 신청을 수정한다", () => {
  assert.match(publicAction, /findExistingTrialApplicationForEdit/);
  assert.match(publicAction, /activeTrialDuplicateWhereClause/);
  assert.match(publicAction, /UPDATE "TrialLead" SET/);
  assert.match(publicAction, /mode: "updated" as const, duplicate: true/);
  assert.match(trialForm, /findExistingTrialApplicationForEdit/);
  assert.match(trialForm, /existingId: existingLeadId \|\| undefined/);
  assert.match(trialForm, /기존 체험 신청서를 불러왔습니다/);
});

test("공개 수강신청은 기존 신청서를 불러와 수정하고 승인 건은 중복 생성하지 않는다", () => {
  assert.match(publicAction, /findExistingEnrollApplicationForEdit/);
  assert.match(publicAction, /UPDATE "EnrollmentApplication" SET/);
  assert.match(publicAction, /mode: "existing" as const,\s*duplicate: true/);
  assert.match(enrollForm, /findExistingEnrollApplicationForEdit/);
  assert.match(enrollForm, /existingId: existingApplicationId \|\| undefined/);
  assert.match(enrollForm, /기존 수강신청서를 불러왔습니다/);
  assert.match(enrollForm, /이미 승인된 수강신청서가 있습니다/);
});
