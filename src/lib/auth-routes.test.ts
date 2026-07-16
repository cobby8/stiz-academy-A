import assert from "node:assert/strict";
import test from "node:test";
import {
  canRoleAccessPath,
  defaultPathForRole,
  isSafeInternalPath,
  parseAppRole,
  resolveRedirectForRole,
// Node's type-stripping test runner needs the runtime extension; the app build
// intentionally keeps allowImportingTsExtensions disabled.
// @ts-expect-error -- exercised directly by `node --experimental-strip-types --test`
} from "./auth-routes.ts";

test("roles land on their primary workspace", () => {
  assert.equal(defaultPathForRole("ADMIN"), "/admin");
  assert.equal(defaultPathForRole("VICE_ADMIN"), "/admin");
  assert.equal(defaultPathForRole("INSTRUCTOR"), "/staff");
  assert.equal(defaultPathForRole("PARENT"), "/mypage");
});

test("staff-login context sends every role to its own primary workspace", () => {
  assert.equal(resolveRedirectForRole("ADMIN", "/staff", { preferRoleHome: true }), "/admin");
  assert.equal(resolveRedirectForRole("INSTRUCTOR", "/staff", { preferRoleHome: true }), "/staff");
  assert.equal(resolveRedirectForRole("PARENT", "/staff", { preferRoleHome: true }), "/mypage");
});

test("an explicit permitted deep link is preserved", () => {
  assert.equal(resolveRedirectForRole("ADMIN", "/staff/students?tab=active"), "/staff/students?tab=active");
  assert.equal(
    resolveRedirectForRole("INSTRUCTOR", "/staff/billing?student=student-1&status=unpaid"),
    "/staff/billing?student=student-1&status=unpaid",
  );
  assert.equal(resolveRedirectForRole("INSTRUCTOR", "/staff/sessions/lesson-1"), "/staff/sessions/lesson-1");
  assert.equal(resolveRedirectForRole("PARENT", "/mypage/reports"), "/mypage/reports");
});

test("role boundaries use complete path segments", () => {
  assert.equal(canRoleAccessPath("PARENT", "/administrator-guide"), true);
  assert.equal(canRoleAccessPath("PARENT", "/staffing"), true);
  assert.equal(canRoleAccessPath("INSTRUCTOR", "/mypage"), false);
  assert.equal(canRoleAccessPath("ADMIN", "/mypage"), false);
});

test("unsafe redirects and invalid role metadata are rejected", () => {
  assert.equal(isSafeInternalPath("//evil.example"), false);
  assert.equal(isSafeInternalPath("/%2f%2fevil.example"), false);
  assert.equal(isSafeInternalPath("/login?next=/admin"), false);
  assert.equal(isSafeInternalPath("/staff/billing?next=https://evil.example"), true);
  assert.equal(parseAppRole("OWNER"), null);
  assert.equal(resolveRedirectForRole("INSTRUCTOR", "https://evil.example"), "/staff");
});
