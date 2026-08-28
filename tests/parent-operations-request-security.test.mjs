import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const action = readFileSync("src/app/actions/parent-operations-request.ts", "utf8");
const adminAction = readFileSync("src/app/actions/operations-sync.ts", "utf8");
const page = readFileSync("src/app/request/[token]/page.tsx", "utf8");
const form = readFileSync("src/app/request/[token]/ParentRequestForm.tsx", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260827190000_add_parent_operations_request_links/migration.sql",
  "utf8",
);
const completionMigration = readFileSync(
  "prisma/migrations/20260828090000_complete_operations_sync_infrastructure/migration.sql",
  "utf8",
);
const operationsPreflight = readFileSync("scripts/operations-sync-db-preflight.mjs", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const infrastructure = readFileSync("src/lib/operationsSyncInfrastructure.ts", "utf8");
const linkPanel = readFileSync("src/app/admin/operations-sync/ParentRequestLinkPanel.tsx", "utf8");
const operationsUi = readFileSync("src/app/admin/operations-sync/OperationsSyncClient.tsx", "utf8");

test("공개 토큰은 원문 대신 SHA-256 해시만 DB에 저장한다", () => {
  assert.match(action, /createHash\("sha256"\)/);
  assert.match(action, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(action, /VALUES \(\$1,\$2,\$3,\$4,\$5\)/);
  assert.match(action, /id, studentId, tokenHash\(token\), expiresAt/);
  assert.doesNotMatch(migration, /\btoken\s+TEXT/i);
  assert.match(schema, /tokenHash\s+String\s+@unique/);
});

test("만료·취소·사용 완료 링크는 제출을 거부하고 미리보기 상태를 구분한다", () => {
  assert.match(action, /if \(row\.expiresAt\.getTime\(\) <= Date\.now\(\)\) return \{ status: "EXPIRED" \}/);
  assert.match(action, /if \(!row\) return \{ status: "INVALID" \}/);
  assert.match(action, /if \(row\.revokedAt\) return \{ status: row\.lastUsedAt \? "USED" : "INVALID" \}/);
  assert.match(action, /l\."revokedAt" IS NULL AND l\."expiresAt">now\(\)/);
  assert.match(action, /SET "revokedAt"=now\(\)/);
});

test("공개 제출은 링크에 묶인 학생만 사용하고 DRAFT 접수만 만든다", () => {
  assert.match(action, /command\.sourceText, link\.studentId, link\.studentName/);
  assert.match(action, /studentName: link\.studentName/);
  assert.match(action, /VALUES \(\$1,\$2,\$3,'DRAFT'/);
  assert.doesNotMatch(action, /applyOperations|executeOperations|syncGoogle|syncRallyz|sendSms|sendNotification/);
  assert.match(form, /원장님이 내용을 확인하고 승인한 뒤 반영합니다/);
});

test("공개 접수의 청구와 알림은 항상 HELD로 시작한다", () => {
  assert.match(action, /"billingStatus","notificationStatus"/);
  assert.match(action, /'HELD','HELD'/);
  assert.match(migration, /"billingStatus" TEXT NOT NULL DEFAULT 'HELD'/);
  assert.match(migration, /"notificationStatus" TEXT NOT NULL DEFAULT 'HELD'/);
});

test("링크 생성·취소·요청 승인은 관리자 인증을 요구한다", () => {
  const protectedFunctions = [
    "createParentOperationsRequestLink",
    "revokeParentOperationsRequestLink",
  ];
  for (const name of protectedFunctions) {
    const start = action.indexOf(`function ${name}`);
    assert.notEqual(start, -1, `${name} 함수가 있어야 한다`);
    assert.match(action.slice(start, start + 500), /requireAdmin\(\)/, `${name}에 관리자 확인이 필요하다`);
  }
  const approveStart = adminAction.indexOf("function approveOperationsRequest");
  assert.notEqual(approveStart, -1);
  assert.match(adminAction.slice(approveStart, approveStart + 500), /requireAdmin\(\)/);
});

test("같은 링크의 같은 요청은 고유 멱등 키로 중복 생성되지 않는다", () => {
  assert.match(action, /scope: `PARENT_LINK:\$\{link\.id\}`/);
  assert.match(schema, /idempotencyKey\s+String\s+@unique/);
  assert.match(action, /이미 같은 내용으로 접수된 요청입니다/);
});

test("링크는 트랜잭션 안에서 원자적으로 1회만 선점한다", () => {
  const transaction = action.slice(action.indexOf("await prisma.$transaction", action.indexOf("function submitParentOperationsRequest")));
  const claimAt = transaction.indexOf('UPDATE "ParentOperationsRequestLink" SET "revokedAt"=now()');
  const requestAt = transaction.indexOf('INSERT INTO "OperationsRequest"');
  assert.ok(claimAt >= 0 && requestAt > claimAt, "링크 선점이 요청 생성보다 먼저여야 한다");
  assert.match(transaction, /WHERE id=\$1 AND "revokedAt" IS NULL AND "expiresAt">now\(\)/);
  assert.match(transaction, /if \(claimed !== 1\) throw new Error\("REQUEST_LINK_ALREADY_USED"\)/);
});

test("관리자는 활성 링크를 조회하고 화면에서 취소할 수 있다", () => {
  const listStart = action.indexOf("function getActiveParentOperationsRequestLinks");
  assert.notEqual(listStart, -1);
  assert.match(action.slice(listStart, listStart + 500), /requireAdmin\(\)/);
  assert.match(action.slice(listStart, listStart + 1000), /"revokedAt" IS NULL AND l\."expiresAt">now\(\)/);
  assert.match(linkPanel, /getActiveParentOperationsRequestLinks/);
  assert.match(linkPanel, /revokeParentOperationsRequestLink\(linkId\)/);
  assert.match(linkPanel, />취소<\/button>/);
});

test("런타임 기반시설 확인은 DB 구조를 변경하지 않고 읽기만 한다", () => {
  assert.match(infrastructure, /information_schema\.columns/);
  assert.match(infrastructure, /\$queryRawUnsafe/);
  assert.doesNotMatch(infrastructure, /\$executeRawUnsafe/);
  assert.doesNotMatch(infrastructure, /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|CONSTRAINT)\b/i);
});

test("독립 마이그레이션은 운영 동기화 원장을 의존 순서대로 준비한다", () => {
  const requestAt = migration.indexOf('CREATE TABLE IF NOT EXISTS "OperationsRequest"');
  const commandAt = migration.indexOf('CREATE TABLE IF NOT EXISTS "OperationsCommand"');
  const attemptAt = migration.indexOf('CREATE TABLE IF NOT EXISTS "OperationsSyncAttempt"');
  const linkAt = migration.indexOf('CREATE TABLE IF NOT EXISTS "ParentOperationsRequestLink"');
  const linkFkAt = migration.indexOf('FOREIGN KEY ("parentRequestLinkId")');
  assert.ok(requestAt >= 0 && commandAt > requestAt && attemptAt > commandAt);
  assert.ok(linkAt > attemptAt && linkFkAt > linkAt);
  assert.match(migration, /"requestId" TEXT NOT NULL REFERENCES "OperationsRequest"\(id\)/);
  assert.match(migration, /"commandId" TEXT NOT NULL REFERENCES "OperationsCommand"\(id\)/);
});

test("홈페이지 반영은 승인 당시 상태와 영향 행 수가 모두 맞아야 성공한다", () => {
  const applyStart = adminAction.indexOf("function applyOperationsWebsite");
  const recordStart = adminAction.indexOf("function recordOperationsExternalCheck");
  const applyBody = adminAction.slice(applyStart, recordStart);
  assert.match(applyBody, /beforeJson/);
  assert.match(applyBody, /WHERE id=\$1 AND status=\$3/);
  assert.match(applyBody, /if \(affected !== 1\) throw new Error\(`ENROLLMENT_CONFLICT:/);
  assert.match(applyBody, /target='WEBSITE' AND "processingToken"=\$2 AND status IN \('PENDING','FAILED'\)/);
  assert.match(applyBody, /if \(attemptAffected !== 1\) throw new Error\("WEBSITE_ATTEMPT_CONFLICT"\)/);
  assert.match(applyBody, /await prisma\.\$transaction/);
  assert.match(applyBody, /markWebsiteConflict/);
});

test("상태 집계는 사람이 재검토해야 하는 HELD를 보존한다", () => {
  const refreshStart = adminAction.indexOf("function refreshOperationsStatuses");
  assert.notEqual(refreshStart, -1);
  const refreshBody = adminAction.slice(refreshStart);
  assert.match(refreshBody, /status AS "commandStatus"/);
  assert.match(refreshBody, /command\.commandStatus === "HELD"\s*\? "HELD"/);
  assert.match(refreshBody, /allHeld \? "HELD" : hasHeld \|\| hasPartial \? "PARTIAL"/);
});

test("재검토는 현재 Enrollment로 snapshot을 다시 만들고 WEBSITE 실패만 재개한다", () => {
  const approveStart = adminAction.indexOf("function approveOperationsRequest");
  const applyStart = adminAction.indexOf("function applyOperationsWebsite");
  const approveBody = adminAction.slice(approveStart, applyStart);
  assert.match(approveBody, /SELECT e\.id, e\.status, c\.name AS "className"/);
  assert.match(approveBody, /"beforeJson"=\$2::jsonb, "afterJson"=\$3::jsonb/);
  assert.match(approveBody, /SET status='PENDING', error=NULL, "verifiedAt"=NULL/);
  assert.match(approveBody, /target='WEBSITE' AND status='FAILED'/);
  assert.doesNotMatch(approveBody, /target IN \('SHEET','RALLYZ'\).*status='PENDING'/s);
});

test("HELD·PARTIAL 요청에는 현재 상태로 재검토 버튼을 표시한다", () => {
  assert.match(operationsUi, /\["DRAFT", "HELD", "PARTIAL"\]\.includes\(request\.status\)/);
  assert.match(operationsUi, /현재 상태로 재검토/);
  assert.match(operationsUi, /approveOperationsRequest\(request\.id\)/);
});

test("OperationsCommand 멱등 키는 migration 체인이 보장하고 배포 전에 구조·보안을 검사한다", () => {
  const uniqueIndex = /CREATE UNIQUE INDEX IF NOT EXISTS "OperationsCommand_idempotencyKey_key" ON "OperationsCommand" \("idempotencyKey"\)/;
  assert.match(migration, uniqueIndex);
  assert.match(completionMigration, /"idempotencyKey" TEXT NOT NULL UNIQUE/);
  assert.match(completionMigration, /20260827190000_add_parent_operations_request_links/);
  assert.match(completionMigration, /20260827223000_add_operations_sync_processing_lease/);
  assert.match(completionMigration, /CREATE TABLE IF NOT EXISTS "OperationsRequest"/);
  assert.match(completionMigration, /CREATE TABLE IF NOT EXISTS "RallyzAttendanceSyncItem"/);
  assert.match(operationsPreflight, /REQUIRED_OPERATIONS_SYNC_COLUMNS/);
  assert.match(operationsPreflight, /REQUIRED_OPERATIONS_SYNC_UNIQUE_KEYS/);
  assert.match(operationsPreflight, /relrowsecurity/);
  assert.match(operationsPreflight, /role_table_grants/);
  assert.match(operationsPreflight, /\["anon", "authenticated"\]/);
});

test("ACTIVE·EXPIRED·INVALID 상태별 공개 화면이 있다", () => {
  assert.match(page, /preview\.status === "ACTIVE"/);
  assert.match(form, /context\.linkStatus === "EXPIRED"/);
  assert.match(form, /링크 사용 기간이 끝났습니다/);
  assert.match(form, /올바르지 않은 링크입니다/);
});

test("공개 URL에는 학생 식별값이 없고 화면에는 이름을 마스킹한다", () => {
  assert.match(action, /token = randomBytes\(32\)/);
  assert.match(page, /studentName\.slice\(0, 1\).*○.*studentName\.slice\(-1\)/);
  assert.doesNotMatch(page, /studentId/);
});
