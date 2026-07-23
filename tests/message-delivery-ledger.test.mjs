import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../prisma/migrations/20260724030000_add_message_delivery_ledger/migration.sql", import.meta.url),
  "utf8",
);
const helper = readFileSync(new URL("../src/lib/message-ledger.ts", import.meta.url), "utf8");

test("기존 발송 행과 호환되는 묶음·건별 장부 메타데이터를 추가한다", () => {
  assert.match(schema, /model MessageDeliveryBatch/);
  assert.match(schema, /model MessageSettingAuditLog/);
  for (const field of [
    "batchId",
    "source",
    "actorUserId",
    "actorName",
    "purpose",
    "reason",
    "templateId",
    "templateVersion",
    "bodyHash",
    "recipientPhoneHash",
    "recipientPhoneLast4",
    "stableEventKey",
  ]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(migration, /ALTER COLUMN[^;]+SET NOT NULL/i);
  assert.doesNotMatch(migration, /UPDATE public\."NotificationDelivery"/);
});

test("문자 장부와 설정 감사로그는 브라우저 역할에서 접근할 수 없다", () => {
  for (const table of [
    "NotificationDelivery",
    "MessageDeliveryBatch",
    "MessageSettingAuditLog",
    "SmsTemplate",
    "MessageAutomationRule",
    "MessageChannelSetting",
  ]) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\."${table}" ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\."${table}" FORCE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`REVOKE ALL ON TABLE public\\."${table}" FROM anon, authenticated`));
  }
});

test("전화번호는 비밀키 HMAC, 본문은 SHA-256, 중복키는 안정적인 입력으로 만든다", () => {
  assert.match(helper, /createHmac\("sha256", privacySecret\(\)\)/);
  assert.match(helper, /createHash\("sha256"\)/);
  assert.match(helper, /NOTIFICATION_PRIVACY_SECRET_MISSING/);
  assert.match(helper, /eventKey\.trim\(\)/);
  assert.match(helper, /recipientPhoneHash/);
  assert.match(helper, /AUDIT_SAFE_KEYS/);
  assert.match(helper, /safe\.bodyHash = hashMessageBody/);
  const dedupeSection = helper.slice(
    helper.indexOf("export function buildMessageDedupeKey"),
    helper.indexOf("export async function reserveMessageDeliveryBatch"),
  );
  assert.doesNotMatch(dedupeSection, /Math\.random|randomUUID/);
});

test("운영 값의 범위를 DB 제약으로 막고 SENDING 상태를 허용한다", () => {
  assert.match(migration, /NotificationDelivery_status_check[\s\S]+?'SENDING'/);
  assert.match(migration, /MessageDeliveryBatch_source_check/);
  assert.match(migration, /MessageDeliveryBatch_status_check/);
  assert.match(migration, /MessageDeliveryBatch_counts_check/);
  assert.match(migration, /NotificationDelivery_bodyHash_check/);
  assert.match(migration, /NotificationDelivery_recipientPhoneHash_check/);
  assert.match(migration, /MessageSettingAuditLog_settingType_check/);
  assert.match(migration, /MessageSettingAuditLog_action_check/);
  assert.match(migration, /CREATE UNIQUE INDEX "MessageDeliveryBatch_source_stableEventKey_key"/);
});
