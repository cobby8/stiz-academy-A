import assert from "node:assert/strict";
import test from "node:test";
import { canExposeStaffBilling, resolveStaffBillingGuard } from "../src/lib/staff-billing-policy.ts";

const ok = { paymentClassId: "class-a", amountMismatch: false, studentMismatch: false };

test("반·금액·학생이 모두 맞으면 교사가 수납 확인을 요청할 수 있다", () => {
  assert.deepEqual(resolveStaffBillingGuard(ok), { confirmable: true, blockReason: null });
});

test("반 정보가 없는 과거 청구는 사유와 함께 막는다 (DB 복합 외래키 위반 방지)", () => {
  const guard = resolveStaffBillingGuard({ ...ok, paymentClassId: null });
  assert.equal(guard.confirmable, false);
  assert.match(guard.blockReason, /반 정보/);
});

test("금액이 어긋나면 청구를 숨기지 않고 요청만 막는다", () => {
  const guard = resolveStaffBillingGuard({ ...ok, amountMismatch: true });
  assert.equal(guard.confirmable, false);
  assert.match(guard.blockReason, /금액/);
});

test("학생 불일치가 금액 불일치보다 먼저 안내된다", () => {
  const guard = resolveStaffBillingGuard({ paymentClassId: null, amountMismatch: true, studentMismatch: true });
  assert.match(guard.blockReason, /학생 정보/);
});

test("수업 귀속 정보가 없는 청구는 노출하지 않는다", () => {
  assert.equal(canExposeStaffBilling({ paymentClassId: null, accessibleClassIds: ["class-a"] }), false);
});

test("담당 수업에 명시적으로 귀속된 청구만 노출한다", () => {
  assert.equal(canExposeStaffBilling({ paymentClassId: "class-a", accessibleClassIds: ["class-a"] }), true);
  assert.equal(canExposeStaffBilling({ paymentClassId: "class-b", accessibleClassIds: ["class-a"] }), false);
});
