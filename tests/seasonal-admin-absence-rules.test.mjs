import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAssignableResolution,
  canConfirm,
  perSessionAmount,
  RESOLUTION_LABEL,
} from "../src/lib/seasonal/adminAbsenceRules.ts";

test("isAssignableResolution — 보강/이월/환불만 허용, PENDING·잘못된 값 거부", () => {
  assert.equal(isAssignableResolution("MAKEUP"), true);
  assert.equal(isAssignableResolution("CARRYOVER"), true);
  assert.equal(isAssignableResolution("REFUND"), true);
  assert.equal(isAssignableResolution("PENDING"), false); // 미정은 지정 대상 아님
  assert.equal(isAssignableResolution("FOO"), false);
  assert.equal(isAssignableResolution(null), false);
  assert.equal(isAssignableResolution(undefined), false);
});

test("canConfirm — PENDING/빈값이면 확정 불가, 나머지는 가능", () => {
  assert.equal(canConfirm("PENDING"), false);
  assert.equal(canConfirm(null), false);
  assert.equal(canConfirm(undefined), false);
  assert.equal(canConfirm(""), false);
  assert.equal(canConfirm("MAKEUP"), true);
  assert.equal(canConfirm("CARRYOVER"), true);
  assert.equal(canConfirm("REFUND"), true);
});

test("perSessionAmount — 금액/회차수 나눗셈 + 원 단위 반올림", () => {
  assert.equal(perSessionAmount(120000, 8), 15000); // 정확히 나눠떨어짐
  assert.equal(perSessionAmount(100000, 3), 33333); // 반올림(33333.33 → 33333)
  assert.equal(perSessionAmount(100000, 6), 16667); // 반올림(16666.67 → 16667)
});

test("perSessionAmount — 계산 불가 케이스는 null", () => {
  assert.equal(perSessionAmount(null, 8), null); // 금액 없음
  assert.equal(perSessionAmount(120000, 0), null); // 회차수 0(0으로 나눔 방지)
  assert.equal(perSessionAmount(120000, null), null); // 회차수 없음
  assert.equal(perSessionAmount(-100, 8), null); // 음수 금액
  assert.equal(perSessionAmount(120000, -2), null); // 음수 회차수
});

test("RESOLUTION_LABEL — 4개 처리방식 한국어 라벨", () => {
  assert.equal(RESOLUTION_LABEL.PENDING, "미정");
  assert.equal(RESOLUTION_LABEL.MAKEUP, "보강");
  assert.equal(RESOLUTION_LABEL.CARRYOVER, "이월");
  assert.equal(RESOLUTION_LABEL.REFUND, "환불");
});
