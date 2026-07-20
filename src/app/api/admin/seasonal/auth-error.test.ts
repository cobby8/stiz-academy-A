import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node의 타입 제거 테스트 실행기가 런타임 확장자를 사용합니다.
import { classifyAdminAuthError } from "./auth-error.ts";

test("로그인 실패는 401로 분류한다", () => {
  assert.deepEqual(classifyAdminAuthError(new Error("인증이 필요합니다. 로그인해주세요.")), {
    message: "로그인이 필요합니다.",
    status: 401,
    code: "UNAUTHORIZED",
  });
});

test("역할 부족은 403으로 분류한다", () => {
  assert.deepEqual(classifyAdminAuthError(new Error("관리자 권한이 필요합니다.")), {
    message: "관리자 권한이 필요합니다.",
    status: 403,
    code: "FORBIDDEN",
  });
});

test("예상하지 못한 서버 오류는 인증 오류로 숨기지 않는다", () => {
  assert.equal(classifyAdminAuthError(new Error("database connection failed")), null);
  assert.equal(classifyAdminAuthError("unknown failure"), null);
});
