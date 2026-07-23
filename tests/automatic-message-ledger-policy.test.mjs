import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const notification = readFileSync("src/lib/notification.ts", "utf8");
const ledger = readFileSync("src/lib/message-ledger.ts", "utf8");
const dispatch = readFileSync("src/lib/message-dispatch.ts", "utf8");

test("일반 자동문자는 규칙 누락과 조회 오류에서 fail-closed로 차단한다", () => {
  assert.match(notification, /if \(!input\.trigger\)[\s\S]*?enabled: false/);
  assert.match(notification, /if \(!rows\.length\)[\s\S]*?enabled: false/);
  assert.match(notification, /catch \{[\s\S]*?enabled: false/);
  assert.match(notification, /input\.source === "SECURITY"[\s\S]*?requestedChannel: "SMS"/);
  assert.match(notification, /fallbackChannelEnabled === true/);
  assert.match(notification, /fallbackEnabled: configuredChannelEnabled && validFallback !== null/);
});

test("휴대폰 인증 문자는 관리자 OFF 대상이 아니며 SECURITY 장부에 남긴다", () => {
  assert.match(dispatch, /source: "SECURITY"/);
  assert.match(dispatch, /audienceScope: "SECURITY"/);
  assert.match(dispatch, /requestedChannel: "SMS"/);
  assert.match(dispatch, /fallbackEnabled: false/);
  assert.match(dispatch, /finalizeMessageDeliveryBatch\(batchId\)/);
});

test("자동 발송 장부는 원문 대신 전화번호 HMAC과 본문 해시를 기록한다", () => {
  assert.match(ledger, /hashMessageRecipientPhone\(input\.recipientPhone\)/);
  assert.match(ledger, /hashMessageBody\(input\.body\)/);
  assert.match(ledger, /"recipientPhone", "recipientPhoneHash", "recipientPhoneLast4"/);
  assert.match(ledger, /\$7, NULL, \$8, \$9/);
  assert.match(notification, /source = input\.source \?\? "AUTO"/);
});

test("공급자 결과와 실제 채널을 건별 장부와 묶음 장부에 확정한다", () => {
  assert.match(ledger, /channel = COALESCE\(\$5, channel\)/);
  assert.match(ledger, /"messageType" = \$5/);
  assert.match(ledger, /"providerGroupId" = \$6, "providerMessageId" = \$7/);
  assert.match(ledger, /"lockedAt" = NULL, "lockToken" = NULL/);
  assert.match(ledger, /"totalCount" = counts\.total_count/);
  assert.match(notification, /finalizeMessageDeliveryBatch/);
});

test("특강 자동문자도 자동화 채널 및 fallback 정책을 통과한다", () => {
  const dispatchAt = notification.indexOf("export async function dispatchReservedSmsDelivery");
  const section = notification.slice(dispatchAt, notification.indexOf("export async function finalizeReservedSmsWithoutDispatch"));
  assert.match(section, /getAutomationPolicy/);
  assert.match(section, /sendMessageDetailed/);
  assert.match(section, /fallbackEnabled: policy\.fallbackEnabled/);
  assert.match(section, /fallbackChannel: policy\.fallbackChannel/);
});

test("관리자와 코치 자동문자는 비활성 템플릿을 하드코딩 문구로 우회하지 않는다", () => {
  assert.doesNotMatch(notification, /adminFallback|coachFallback/);
  assert.match(notification, /admin\.phone && adminSmsMsg && smsOptions\?\.adminTrigger/);
  assert.match(notification, /phone && coachSmsMsg && smsOptions\?\.coachTrigger/);
});

test("기본 채널 OFF 시 기본 공급자를 호출하지 않고 대체 채널과 감사 이력을 분리한다", () => {
  assert.match(notification, /deliveryChannel: configuredChannelEnabled \? requestedChannel : validFallback!/);
  assert.match(notification, /preselectedFallback: !configuredChannelEnabled/);
  assert.match(notification, /requestedChannel: policy\.deliveryChannel/);
  assert.match(notification, /requestedChannel: policy\.requestedChannel/);
  assert.match(notification, /fallbackUsed: policy\.preselectedFallback \|\| result\.fallbackUsed/);
});
