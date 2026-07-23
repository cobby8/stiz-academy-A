import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("src/lib/seasonal/service.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260722180000_guard_duplicate_seasonal_applications/migration.sql",
  "utf8",
);

test("특강 신청은 정규화한 학생·보호자 식별 지문을 각 항목에 저장한다", () => {
  assert.match(service, /input\.child\.name\.replace\(\/\\s\+\/g, ""\)/);
  assert.match(service, /input\.parent\.phone\.replace\(\/\[\^0-9\]\/g, ""\)/);
  assert.match(service, /createHash\("sha256"\)/);
  assert.match(service, /applicantFingerprint: fingerprint/);
  assert.match(schema, /applicantFingerprint\s+String\?/);
});

test("활성 신청만 중복으로 막고 취소·반려 후 재신청은 허용한다", () => {
  assert.match(service, /ACTIVE_APPLICATION_ITEM_STATUSES = \["PENDING", "APPROVED", "WAITLISTED"\]/);
  assert.match(service, /findActiveDuplicate\(tx, scopedOfferingIds, fingerprint\)/);
  assert.match(service, /"DUPLICATE_APPLICATION"/);
  assert.match(migration, /ranked\.status IN \('PENDING', 'APPROVED', 'WAITLISTED'\)/);
  assert.doesNotMatch(migration, /duplicate_rank = 1/);
});

test("동시 요청은 특강 잠금과 DB 고유 인덱스로 이중 방어한다", () => {
  assert.match(service, /ORDER BY id FOR UPDATE/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /error\.code === "P2002"/);
  assert.doesNotMatch(migration, /active_applicant_key/);
});

test("기존 멱등성 키 재요청은 중복 신청 검사보다 먼저 기존 결과를 반환한다", () => {
  const idempotencyLookup = service.indexOf("existingApplication(season.id, input.idempotencyKey)");
  const fingerprintCreation = service.indexOf("const fingerprint = applicantFingerprint(input)");
  assert.ok(idempotencyLookup >= 0);
  assert.ok(fingerprintCreation > idempotencyLookup);
  assert.match(service, /if \(duplicate\) return duplicateApplicationResponse\(duplicate, season\.title\)/);
});
