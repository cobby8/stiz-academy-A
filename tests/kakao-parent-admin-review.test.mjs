import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const action = fs.readFileSync("src/app/actions/kakao-parent-intake-admin.ts", "utf8");
const page = fs.readFileSync("src/app/admin/kakao-requests/page.tsx", "utf8");
const client = fs.readFileSync("src/app/admin/kakao-requests/KakaoRequestsClient.tsx", "utf8");
const migration = fs.readFileSync("prisma/migrations/20260903160000_add_kakao_intake_admin_review/migration.sql", "utf8");

test("관리자 검토는 인증된 학생 안정 ID를 확인한다", () => {
  assert.match(action, /identityStatus !== "ACTIVE"/);
  assert.match(action, /structuredStudentId !== intake\.studentId/);
});

test("운영 원장 이관은 외부 대상과 알림을 HELD로 유지한다", () => {
  assert.match(action, /'LOW','HELD'/);
  assert.match(action, /'HELD','HELD'/);
  assert.match(action, /externalWrites: false, notificationsSent: false/);
});

test("동시 중복 처리와 감사 누락을 막는다", () => {
  assert.match(action, /"operationsRequestId" IS NULL/);
  assert.match(action, /KakaoParentIntakeAudit/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "KakaoParentIntake_operationsRequestId_key"/);
});

test("접수함은 처리 필터와 안전 경계를 보여준다", () => {
  assert.match(page, /NEEDS_DETAILS/);
  assert.match(client, /운영 원장 이관/);
  assert.match(client, /외부 변경\/알림 없음/);
});
