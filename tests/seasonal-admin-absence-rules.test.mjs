import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAssignableResolution,
  canConfirm,
  perSessionAmount,
  computeCreditDecision,
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

// ── computeCreditDecision (Step 4 크레딧 게이트) ────────────────────────────
test("computeCreditDecision — 확정+이월+결제 = 적립(ACTIVE)", () => {
  const d = computeCreditDecision({ status: "CONFIRMED", resolution: "CARRYOVER", paid: true, amount: 15000 });
  assert.equal(d.present, true);
  assert.equal(d.amount, 15000);
  assert.equal(d.creditStatus, "ACTIVE");
  assert.equal(d.note, null); // 이월은 note 없음
});

test("computeCreditDecision — 확정+환불+결제 = 적립 + '환불 대상' 표기", () => {
  const d = computeCreditDecision({ status: "CONFIRMED", resolution: "REFUND", paid: true, amount: 20000 });
  assert.equal(d.present, true);
  assert.equal(d.amount, 20000);
  assert.equal(d.creditStatus, "ACTIVE");
  assert.equal(d.note, "환불 대상"); // 자동 송금 금지 — 기록만
});

test("computeCreditDecision — 보강(MAKEUP)은 확정·결제여도 크레딧 없음", () => {
  const d = computeCreditDecision({ status: "CONFIRMED", resolution: "MAKEUP", paid: true, amount: 15000 });
  assert.equal(d.present, false);
  assert.equal(d.amount, 0);
});

test("computeCreditDecision — 미결제면 이월/환불이어도 skip", () => {
  const d = computeCreditDecision({ status: "CONFIRMED", resolution: "CARRYOVER", paid: false, amount: 15000 });
  assert.equal(d.present, false);
});

test("computeCreditDecision — 미확정(REPORTED)이면 크레딧 없음(되돌리기 동기화)", () => {
  const d = computeCreditDecision({ status: "REPORTED", resolution: "CARRYOVER", paid: true, amount: 15000 });
  assert.equal(d.present, false);
  const d2 = computeCreditDecision({ status: "REPORTED", resolution: "REFUND", paid: true, amount: 15000 });
  assert.equal(d2.present, false);
});

test("computeCreditDecision — 금액 계산 불가/0 이하이면 적립 안 함", () => {
  assert.equal(computeCreditDecision({ status: "CONFIRMED", resolution: "CARRYOVER", paid: true, amount: null }).present, false);
  assert.equal(computeCreditDecision({ status: "CONFIRMED", resolution: "CARRYOVER", paid: true, amount: 0 }).present, false);
  assert.equal(computeCreditDecision({ status: "CONFIRMED", resolution: "REFUND", paid: true, amount: -5 }).present, false);
});

test("computeCreditDecision — PENDING/잘못된 resolution 은 크레딧 없음", () => {
  assert.equal(computeCreditDecision({ status: "CONFIRMED", resolution: "PENDING", paid: true, amount: 15000 }).present, false);
  assert.equal(computeCreditDecision({ status: "CONFIRMED", resolution: "FOO", paid: true, amount: 15000 }).present, false);
});
