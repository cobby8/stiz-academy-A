import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/lib/staff-class-people.ts", import.meta.url),
  "utf8",
);
const action = readFileSync(
  new URL("../src/app/actions/staff-class-people.ts", import.meta.url),
  "utf8",
);

test("담당 수업 권한을 확인하고 개인정보를 캐시하지 않는다", () => {
  assert.match(source, /noStore\(\)/);
  assert.match(source, /requireStaffClassAccess\(classId\)/);
  assert.doesNotMatch(source, /console\.(?:log|error)/);
});

test("학생, 복수 보호자, 출결, 청구 요약을 한 번의 묶음 조회로 가져온다", () => {
  const queryCount = source.match(/prisma\.\$queryRawUnsafe/g)?.length ?? 0;
  assert.equal(queryCount, 1);
  assert.match(source, /WITH active_students AS/);
  assert.match(source, /jsonb_agg/);
  assert.match(source, /recent_attendance AS/);
  assert.match(source, /billing_summary AS/);
});

test("활성 수강생과 해당 수업 결제만 노출한다", () => {
  assert.match(source, /e\.status = 'ACTIVE'/);
  assert.match(source, /p\."classId" = \$1/);
  assert.match(source, /se\."classId" = \$1/);
});

test("UI용 Server Action은 입력을 제한하고 조회 결과만 직렬화해 반환한다", () => {
  assert.match(action, /^"use server";/);
  assert.match(action, /export async function loadStaffClassPeople/);
  assert.match(action, /getStaffClassPeople\(classId, sessionId\)/);
  assert.match(action, /Promise<LoadStaffClassPeopleResult>/);
  assert.doesNotMatch(action, /prisma/);
});
