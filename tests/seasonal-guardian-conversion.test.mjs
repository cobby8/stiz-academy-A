import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/admin/seasonal/route.ts", "utf8");
const conversion = route.slice(route.indexOf("async function convertApprovedItemToEnrollmentAndInvoice"));

test("특강 전환은 User 전화가 없을 때 Guardian 전화와 학생 신원을 함께 확인한다", () => {
  assert.match(conversion, /if \(!parentId\) \{\s*const guardianMatches/);
  assert.match(conversion, /JOIN "Guardian" guardian ON guardian\."studentId" = student\.id/);
  assert.match(conversion, /student\.name = \$\{item\.application\.childName\}/);
  assert.match(conversion, /student\."birthDate"[\s\S]*?item\.application\.childBirthDate/);
  assert.match(conversion, /regexp_replace\(COALESCE\(guardian\.phone/);
});

test("Guardian 후보가 여러 명이면 자동 병합하지 않는다", () => {
  assert.match(conversion, /LIMIT 2/);
  assert.match(conversion, /guardianMatches\.length > 1/);
  assert.match(conversion, /GUARDIAN_MATCH_AMBIGUOUS/);
});

test("명확한 Guardian 일치는 학생만 재사용하고 청구 계정은 신청 연락처에 귀속한다", () => {
  assert.doesNotMatch(conversion, /parentId = guardianMatches\[0\]\.parentId/);
  assert.match(conversion, /matchedGuardianStudentId = guardianMatches\[0\]\.studentId/);
  assert.match(conversion, /if \(!parentId\) \{\s*const parents = await tx\.\$queryRaw/);
  assert.match(conversion, /let studentId = matchedGuardianStudentId \?\? existingStudents\[0\]\?\.id/);
  assert.match(conversion, /convertedStudentId: studentId/);
});
