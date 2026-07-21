import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node 내장 테스트 러너는 실행할 TypeScript 확장자가 필요합니다.
import { classifyAdminLayoutAuthFailure } from "./adminLayoutAuth.ts";

test("로그인이 필요한 오류만 로그인 이동 대상으로 분류한다", () => {
  assert.equal(
    classifyAdminLayoutAuthFailure(new Error("인증이 필요합니다. 로그인해주세요.")),
    "LOGIN_REQUIRED",
  );
});

test("관리자 권한 부족은 로그인 실패와 구분한다", () => {
  assert.equal(
    classifyAdminLayoutAuthFailure(new Error("관리자 권한이 필요합니다.")),
    "FORBIDDEN",
  );
});

test("DB 장애는 인증 오류로 숨기지 않는다", () => {
  assert.equal(classifyAdminLayoutAuthFailure(new Error("database connection failed")), null);
  assert.equal(classifyAdminLayoutAuthFailure("unknown failure"), null);
});
