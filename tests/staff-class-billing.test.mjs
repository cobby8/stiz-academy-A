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

test("결제와 청구서의 반, 학생, 금액이 모두 일치해야 노출한다", () => {
  assert.match(query, /i\."classId" = p\."classId"/);
  assert.match(query, /i\."studentId" = p\."studentId"/);
  assert.match(query, /i\.amount = p\.amount/);
});

test("수업 전체와 학생 한 명 조회가 같은 안전한 쿼리를 사용한다", () => {
  assert.match(query, /\(\$2::text IS NULL OR p\."studentId" = \$2\)/);
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
