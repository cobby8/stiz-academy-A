import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const query = readFileSync(
  new URL("../src/lib/staff-class-billing.ts", import.meta.url),
  "utf8",
);
const action = readFileSync(
  new URL("../src/app/actions/staff-billing.ts", import.meta.url),
  "utf8",
);

test("수업별 청구는 담당 권한과 활성 수강을 확인하고 한 번에 조회한다", () => {
  assert.match(query, /requireStaffClassAccess\(normalizedClassId\)/);
  assert.match(query, /e\.status = 'ACTIVE'/);
  assert.equal((query.match(/\$queryRawUnsafe/g) ?? []).length, 1);
});

test("반이 박힌 청구와 반이 비어 있는 과거 청구가 모두 보인다", () => {
  // classId가 있으면 그 값을 신뢰하고, 없으면 활성 수강으로 잇는다.
  assert.match(query, /p\."classId" = \$1/);
  assert.match(query, /p\."classId" IS NULL AND p\.type = 'MONTHLY'/);
  // 반 연결은 화면이 보고 있는 반($1)에 걸린 Enrollment로 판단한다.
  assert.match(query, /e\."classId" = \$1/);
});

test("반 정보 없는 청구는 정규 월 수강료만 허용해 셔틀·특강 유출을 막는다", () => {
  assert.match(query, /p\.type = 'MONTHLY'/);
});

test("금액·학생 불일치는 청구를 숨기지 않고 경고 플래그로 올린다", () => {
  // 조인 조건에서 제거되어야 한다. 남아 있으면 불일치 시 청구가 통째로 사라진다.
  assert.doesNotMatch(query, /AND i\.amount = p\.amount/);
  assert.doesNotMatch(query, /AND i\."studentId" = p\."studentId"/);
  assert.match(query, /\(i\.amount <> p\.amount\) AS "amountMismatch"/);
  assert.match(query, /\(i\."studentId" <> p\."studentId"\) AS "studentMismatch"/);
});

test("수업 전체와 학생 한 명 조회가 같은 안전한 쿼리를 사용한다", () => {
  assert.match(query, /\(\$2::text IS NULL OR p\."studentId" = \$2\)/);
});

test("확인 요청 가능 여부는 화면과 서버가 같은 정책 함수를 쓴다", () => {
  assert.match(query, /resolveStaffBillingGuard/);
  assert.match(action, /resolveStaffBillingGuard/);
});

test("납부 확인 요청은 활성 수강생까지 다시 검증하고 수업 화면을 갱신한다", () => {
  assert.match(action, /requireStaffStudentAccess\(payment\.classId, payment\.studentId\)/);
  assert.match(action, /revalidatePath\(`\/staff\/classes\/\$\{payment\.classId\}`\)/);
});

test("클라이언트는 Server Action을 통해 직렬화된 날짜를 받는다", () => {
  assert.match(action, /export async function loadStaffClassBilling/);
  assert.match(action, /getStaffClassBilling\(classId, studentId\)/);
  assert.match(action, /dueDate: item\.dueDate\.toISOString\(\)/);
  assert.match(action, /paidDate: item\.paidDate\?\.toISOString\(\) \?\? null/);
});
