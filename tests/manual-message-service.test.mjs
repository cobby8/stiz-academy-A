import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminPath = new URL("../src/app/actions/admin.ts", import.meta.url);
const servicePath = new URL("../src/lib/manual-message-service.ts", import.meta.url);

test("수동 문자는 번호를 정규화하고 중복을 제거하며 최대 100명으로 제한한다", async () => {
  const [admin, service] = await Promise.all([
    readFile(adminPath, "utf8"),
    readFile(servicePath, "utf8"),
  ]);

  assert.match(service, /normalizeMessagePhone/);
  assert.match(service, /new Map<string, string>/);
  assert.match(service, /MANUAL_MESSAGE_RECIPIENT_LIMIT = 100/);
  assert.match(admin, /normalizeUniqueManualRecipients/);
  assert.match(admin, /MANUAL_MESSAGE_RECIPIENT_LIMIT/);
});

test("수동 발송은 관리자와 목적을 기록하고 전화번호 원문을 원장에 저장하지 않는다", async () => {
  const [admin, ledger] = await Promise.all([
    readFile(adminPath, "utf8"),
    readFile(new URL("../src/lib/message-ledger.ts", import.meta.url), "utf8"),
  ]);

  assert.match(admin, /await requireAdmin\(\)/);
  assert.match(admin, /source:\s*"MANUAL"/);
  assert.match(admin, /actorUserId:\s*admin\.appUserId/);
  assert.match(admin, /\bpurpose,/);
  assert.match(admin, /reserveMessageDeliveryBatch/);
  assert.match(admin, /reserveMessageDelivery/);
  assert.match(ledger, /"recipientPhone"[\s\S]+?VALUES[\s\S]+?NULL/);
});

test("수동 발송 결과는 건별 공급자 결과와 실패 번호 재시도 계약을 제공한다", async () => {
  const [admin, service] = await Promise.all([
    readFile(adminPath, "utf8"),
    readFile(servicePath, "utf8"),
  ]);

  for (const field of [
    "batchId",
    "duplicateCount",
    "results",
    "retryRecipients",
    "providerMessageId",
    "providerGroupId",
  ]) {
    assert.match(service, new RegExp(`\\b${field}\\b`));
  }
  assert.match(admin, /sendSmsDetailed/);
  assert.match(admin, /finalizeMessageDelivery/);
  assert.match(admin, /finalizeMessageDeliveryBatch/);
});

test("요청 ID 또는 30초 버킷으로 관리자 이중 클릭을 중복 방지한다", async () => {
  const admin = await readFile(adminPath, "utf8");

  assert.match(admin, /requestId\?: string/);
  assert.match(admin, /validateManualMessageRequestId/);
  assert.match(admin, /Math\.floor\(Date\.now\(\) \/ 30_000\)/);
  assert.doesNotMatch(admin, /\[\s*"manual",\s*admin\.appUserId,\s*Date\.now\(\)/);
});

test("공급자 호출 전 SENDING으로 선점하고 확정 기록 실패는 재시도에서 제외한다", async () => {
  const [admin, service] = await Promise.all([
    readFile(adminPath, "utf8"),
    readFile(servicePath, "utf8"),
  ]);

  assert.match(admin, /claimMessageDelivery/);
  assert.match(service, /"UNCERTAIN"/);
  assert.match(service, /uncertain\?: boolean/);
  // 2026-08-03 정정: 예전엔 장부 기록이 실패하면 무조건 status "UNCERTAIN" + ok:false 로 보고했다.
  //   문자는 이미 공급자에게 넘어간 뒤인데 화면엔 '실패'로 떠서, 원장이 다시 눌러 **중복 발송**됐다
  //   (학부모 13명이 같은 안내를 두 통 받음). 이제 발송 성공 여부는 공급자 응답으로만 판정하고,
  //   장부 기록 실패는 uncertain 플래그와 안내 문구로만 알린다.
  assert.match(admin, /uncertain:\s*true/);
  assert.match(admin, /ok:\s*sent\.ok/);
  assert.match(admin, /다시 보내지 마세요/);
  // 재시도는 여전히 '진짜 발송 실패'에만 걸린다.
  assert.match(admin, /retryRecipients[\s\S]+result\.status === "FAILED"/);
});
