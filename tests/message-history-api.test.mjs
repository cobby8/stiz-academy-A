import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../src/app/api/admin/sms/history/route.ts", import.meta.url),
  "utf8",
);

test("문자 이력은 관리자 인증과 최대 조회 개수를 유지한다", () => {
  assert.match(route, /await requireAdmin\(\)/);
  assert.match(route, /Math\.min\([^,]+,\s*100\)/);
  assert.match(route, /Cache-Control": "no-store"/);
});

test("문자 이력은 원문 연락처나 본문 없이 끝 4자리만 조회한다", () => {
  const query = route.slice(route.indexOf("`SELECT"), route.indexOf("LIMIT $1`"));
  assert.match(query, /recipientPhoneLast4/);
  assert.doesNotMatch(query, /d\."recipientPhone"(?!Last4)/);
  assert.doesNotMatch(query, /payloadJSON|bodyHash|metadataJSON/);
  assert.match(route, /\*\*\*-\*\*\*\*-/);
});

test("문자 이력은 운영 추적 필드와 배치 요약을 제공한다", () => {
  assert.match(route, /LEFT JOIN "MessageDeliveryBatch"/);
  assert.match(route, /requestedChannel/);
  assert.match(route, /providerStatus/);
  assert.match(route, /fallbackUsed/);
  assert.match(route, /unitCost/);
  assert.match(route, /errorCode/);
  assert.match(route, /batchSuccessCount/);
  assert.match(route, /source: row\.source \|\| "AUTO"/);
});

test("오래 멈춘 발송과 공급자 접수 후 미확정 발송을 불확실로 표시한다", () => {
  assert.match(route, /10 \* 60 \* 1000/);
  assert.match(route, /row\.providerStatus === "ACCEPTED"/);
  assert.match(route, /row\.errorCode === "FAILED_DELIVERY_UNCERTAIN"/);
  assert.match(route, /status: isUncertain \? "UNCERTAIN" : row\.status/);
  assert.match(route, /isStaleSending/);
});
