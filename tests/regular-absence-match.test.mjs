import { test } from "node:test";
import assert from "node:assert/strict";
import { matchAbsentee, isPassengerAbsent, normalizePhone, normalizeName } from "../src/lib/regular/regularAbsenceMatch.ts";

test("이름+전화 모두 일치하면 매칭", () => {
  const abs = [{ name: "김철수", phone: "010-1234-5678" }];
  assert.equal(matchAbsentee({ name: "김철수", phone: "01012345678" }, abs)?.name, "김철수");
});

test("이름 같아도 전화 다르면 동명이인으로 스킵(오매칭 방지)", () => {
  const abs = [{ name: "김철수", phone: "010-1111-2222" }];
  assert.equal(matchAbsentee({ name: "김철수", phone: "010-9999-8888" }, abs), null);
});

test("한쪽 전화 없으면 이름만으로 매칭(best-effort)", () => {
  const abs = [{ name: "이영희", phone: null }];
  assert.equal(matchAbsentee({ name: "이영희", phone: "01055556666" }, abs)?.name, "이영희");
  const abs2 = [{ name: "이영희", phone: "01055556666" }];
  assert.equal(matchAbsentee({ name: "이영희", phone: null }, abs2)?.name, "이영희");
});

test("이름 공백·대소문자 정규화", () => {
  assert.equal(normalizeName(" 김 철수 "), "김철수");
  const abs = [{ name: "Kim Chul", phone: null }];
  assert.equal(matchAbsentee({ name: "kimchul", phone: null }, abs)?.name, "Kim Chul");
});

test("이름 없으면 매칭 불가(안전)", () => {
  assert.equal(matchAbsentee({ name: null, phone: "01012345678" }, [{ name: "", phone: "01012345678" }]), null);
});

test("이름 불일치면 매칭 안 됨", () => {
  assert.equal(matchAbsentee({ name: "박민수", phone: null }, [{ name: "김철수", phone: null }]), null);
});

test("전화 정규화: 9자리 미만은 null", () => {
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("010-1234-5678"), "01012345678");
});

test("isPassengerAbsent 편의 함수", () => {
  const abs = [{ name: "김철수", phone: null }];
  assert.equal(isPassengerAbsent({ name: "김철수", phone: null }, abs), true);
  assert.equal(isPassengerAbsent({ name: "다른애", phone: null }, abs), false);
});
