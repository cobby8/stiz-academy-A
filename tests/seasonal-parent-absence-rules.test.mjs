import test from "node:test";
import assert from "node:assert/strict";
import { isValidReason, defaultResolution, VALID_REASONS, REASON_LABEL } from "../src/lib/seasonal/parentAbsenceRules.ts";

// 방학특강 사전 결석 신고 순수 규칙 회귀 테스트.
// 실행: node --test --experimental-strip-types tests/seasonal-parent-absence-rules.test.mjs

test("허용된 5개 사유만 valid", () => {
  for (const r of ["ILLNESS_INJURY", "PERSONAL", "FAMILY_TRIP", "SCHOOL_EVENT", "ETC"]) {
    assert.equal(isValidReason(r), true);
  }
  assert.equal(VALID_REASONS.size, 5);
});

test("허용 외 값·비문자열은 invalid", () => {
  assert.equal(isValidReason("HOLIDAY"), false);
  assert.equal(isValidReason(""), false);
  assert.equal(isValidReason(null), false);
  assert.equal(isValidReason(undefined), false);
  assert.equal(isValidReason(123), false);
});

test("질병·부상은 CARRYOVER(이월), 나머지는 MAKEUP(보강)", () => {
  assert.equal(defaultResolution("ILLNESS_INJURY"), "CARRYOVER");
  assert.equal(defaultResolution("PERSONAL"), "MAKEUP");
  assert.equal(defaultResolution("FAMILY_TRIP"), "MAKEUP");
  assert.equal(defaultResolution("SCHOOL_EVENT"), "MAKEUP");
  assert.equal(defaultResolution("ETC"), "MAKEUP");
});

test("모든 사유에 한국어 라벨이 있다", () => {
  for (const r of VALID_REASONS) {
    assert.equal(typeof REASON_LABEL[r], "string");
    assert.ok(REASON_LABEL[r].length > 0);
  }
});
