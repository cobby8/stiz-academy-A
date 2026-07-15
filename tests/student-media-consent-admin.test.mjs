import assert from "node:assert/strict";
import test from "node:test";
import { validateStudentMediaConsentScopes } from "../src/lib/studentMediaConsentAdminPolicy.ts";

test("내부 보관 없이 갤러리 공개를 허용하지 않는다", () => {
  assert.match(validateStudentMediaConsentScopes({ internalAllowed: false, galleryAllowed: true, instagramAllowed: false }), /내부 사진 보관/);
});

test("인스타그램은 내부 보관과 갤러리 동의를 모두 요구한다", () => {
  assert.match(validateStudentMediaConsentScopes({ internalAllowed: true, galleryAllowed: false, instagramAllowed: true }), /모두 필요/);
});

test("단계가 일관된 동의 범위는 통과한다", () => {
  assert.equal(validateStudentMediaConsentScopes({ internalAllowed: true, galleryAllowed: true, instagramAllowed: true }), null);
  assert.equal(validateStudentMediaConsentScopes({ internalAllowed: false, galleryAllowed: false, instagramAllowed: false }), null);
});
