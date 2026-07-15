import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const action=readFileSync(new URL("../src/app/actions/staff-billing.ts",import.meta.url),"utf8");
const query=readFileSync(new URL("../src/lib/staff-portal-queries.ts",import.meta.url),"utf8");
const sql=readFileSync(new URL("../prisma/sql/add_g5_staff_payment_confirmations.sql",import.meta.url),"utf8");
test("교사는 명시적으로 담당 반에 귀속된 청구만 조회한다",()=>{assert.match(query,/p\."classId"=ANY/);assert.match(query,/e\.status='ACTIVE'/);assert.match(query,/i\."classId"=p\."classId"/);});
test("교사 요청은 직접 결제 상태를 바꾸지 않는다",()=>{const requestPart=action.split("export async function reviewStaffPaymentConfirmation")[0];assert.doesNotMatch(requestPart,/SET status='PAID'/);assert.match(requestPart,/requireStaffStudentAccess/);});

const migration = readFileSync(new URL("../prisma/sql/add_g5_staff_payment_confirmations.sql", import.meta.url), "utf8");
const verification = readFileSync(new URL("../prisma/sql/verify_g5_staff_payment_confirmations.sql", import.meta.url), "utf8");

test("요청의 결제·청구서·수업·학생·금액 조합을 DB에서도 고정한다", () => {
  assert.match(migration, /FOREIGN KEY \("paymentId", "classId", "studentId", amount\)/);
  assert.match(migration, /FOREIGN KEY \("invoiceId", "paymentId", "classId", "studentId", amount\)/);
  assert.match(migration, /ON UPDATE CASCADE ON DELETE RESTRICT/);
});

test("검증 SQL은 누락과 공개 권한을 예외로 차단한다", () => {
  assert.match(verification, /DO \$\$/);
  assert.match(verification, /RAISE EXCEPTION/);
  assert.match(verification, /has_table_privilege/);
});
test("관리자 승인만 잠근 결제와 청구서를 검증해 세 원장을 갱신한다",()=>{assert.match(action,/requireAdmin/);assert.match(action,/prisma\.\$transaction/);assert.match(action,/PaymentInvoice[^`]+FOR UPDATE/s);assert.match(action,/invoice\.amount!==payment\.amount/);assert.match(action,/paymentUpdated !== 1 \|\| invoiceUpdated !== 1/);assert.match(action,/PaymentTransaction/);assert.match(action,/PaymentAuditLog/);});
test("대기 요청은 중복 방지되고 Data API에서 차단된다",()=>{assert.match(sql,/WHERE status='PENDING'/);assert.match(sql,/ENABLE ROW LEVEL SECURITY/);assert.match(sql,/REVOKE ALL/);});
test("수납 일시는 발행일과 최근 허용 기간을 서버에서 검증한다",()=>{assert.match(action,/payment\.issuedAt/);assert.match(action,/31 \* 24 \* 60 \* 60_000/);assert.match(action,/invoice\.issuedAt/);});
test("이미 납부되거나 취소된 청구서에는 확인 요청을 만들지 않는다",()=>{const requestPart=action.split("export async function reviewStaffPaymentConfirmation")[0];assert.match(requestPart,/i\.status AS "invoiceStatus"/);assert.match(requestPart,/\['PAID','CANCELED'\]\.includes\(payment\.invoiceStatus\)/);});
