import assert from "node:assert/strict";
import test from "node:test";
// Node's type-stripping test runner needs the runtime extension; the app build
// intentionally keeps allowImportingTsExtensions disabled.
// @ts-expect-error -- exercised directly by `node --experimental-strip-types --test`
import { redirectPathForMyPageRole } from "./mypage-access.ts";

test("only a verified parent role may remain in mypage", () => {
  assert.equal(redirectPathForMyPageRole("PARENT"), null);
});

test("staff roles are redirected to their primary workspaces", () => {
  assert.equal(redirectPathForMyPageRole("ADMIN"), "/admin");
  assert.equal(redirectPathForMyPageRole("VICE_ADMIN"), "/admin");
  assert.equal(redirectPathForMyPageRole("INSTRUCTOR"), "/staff");
});

test("unknown or missing database roles fail closed", () => {
  assert.equal(redirectPathForMyPageRole(undefined), "/");
  assert.equal(redirectPathForMyPageRole("STUDENT"), "/");
});
