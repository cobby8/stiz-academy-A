import assert from "node:assert/strict";
import test from "node:test";
import { canExposeStaffBilling } from "../src/lib/staff-billing-policy.ts";

test("수업 귀속 정보가 없는 청구는 노출하지 않는다", () => {
  assert.equal(canExposeStaffBilling({ paymentClassId: null, accessibleClassIds: ["class-a"] }), false);
});

test("담당 수업에 명시적으로 귀속된 청구만 노출한다", () => {
  assert.equal(canExposeStaffBilling({ paymentClassId: "class-a", accessibleClassIds: ["class-a"] }), true);
  assert.equal(canExposeStaffBilling({ paymentClassId: "class-b", accessibleClassIds: ["class-a"] }), false);
});
