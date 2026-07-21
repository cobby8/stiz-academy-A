import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/admin/seasonal/route.ts", "utf8");
const service = readFileSync("src/lib/seasonal/service.ts", "utf8");

test("공개 신청은 저장 성공 뒤 접수 안내를 보내고 중복 신청은 즉시 반환한다", () => {
  const duplicateReturn = service.indexOf("return applicationResponse(duplicate, true)");
  const receivedSend = service.indexOf("trigger: SEASONAL_SMS_TRIGGERS.received");
  assert.ok(duplicateReturn >= 0 && receivedSend > duplicateReturn);
  assert.match(service, /const committed = await prisma\.\$transaction/);
  assert.match(service, /reserveSeasonalParentSms\(tx/);
  assert.match(service, /dispatchSeasonalParentSms/);
  assert.match(service, /notificationWarning/);
});

test("상태가 실제로 바뀐 경우에만 항목 알림과 감사 기록을 만든다", () => {
  assert.match(route, /const changed = before\.status !== params\.status/);
  assert.match(route, /if \(changed\) await tx\.specialProgramAuditLog\.create/);
  assert.match(route, /if \(!result\.changed \|\| !trigger \|\| !result\.reservation\) return null/);
});

test("업무 성공과 문자 실패를 분리하고 일괄 결과에도 실패 수를 제공한다", () => {
  assert.match(route, /notificationsFailed: results\.filter\(\(result\) => result\.notificationWarning\)\.length/);
  assert.match(route, /notificationWarning/);
  assert.match(route, /success: summary\.failed === 0/);
});

test("전환 안내는 신규 계정과 기존 계정에 필요한 링크만 선택한다", () => {
  assert.match(route, /activationUrl: activation\.activationRequired.*\? publicUrl\(activation\.activationUrl!\) : ""/s);
  assert.match(route, /paymentUrl: activation\.activationRequired \? "" : publicUrl/);
  assert.match(route, /activationRequired: activation\.activationRequired/);
  const conversion = route.slice(route.indexOf("async function convertApprovedItemToEnrollmentAndInvoice"), route.indexOf("async function issueAccountClaimForItem"));
  assert.doesNotMatch(conversion, /\.\.\.activation,\s*notification/);
  assert.doesNotMatch(conversion, /return \{[^}]*activationUrl:/s);
});

test("GET은 원문 개인정보 없이 최신 발송 요약을 계층별로 제공한다", () => {
  assert.match(route, /"payloadJSON"->>'eventId' = ANY\(\$1::text\[\]\)/);
  assert.doesNotMatch(route, /take: 2000/);
  assert.match(route, /notificationSummary: newestNotification/);
  assert.doesNotMatch(route, /notificationSummary[^}]+recipientPhone/s);
});

test("관리자 재발송은 새 실행 ID를 쓰고 활성화 링크는 다시 발급한다", () => {
  assert.match(route, /body\.resource === "notificationRetry"/);
  assert.match(route, /const deliveryRunId = params\.idempotencyKey \|\| randomUUID\(\)/);
  assert.match(route, /pg_advisory_xact_lock/);
  assert.match(route, /expireStaleSmsDeliveries\(tx\)/);
  assert.match(route, /latest\.status === "PENDING" \|\| latest\.status === "SENDING"/);
  assert.match(route, /NOTIFICATION_DELIVERY_UNCERTAIN/);
  assert.match(route, /issueParentAccountClaim\([\s\S]*enforceCooldown: false,[\s\S]*\}, tx\)/);
  assert.match(route, /const reservation = await reserveSeasonalParentSms\(tx/);
  assert.match(route, /notification: notificationSummary/);
});

test("접수 안내는 현재 처리 상태와 무관하게 재발송할 수 있다", () => {
  assert.match(route, /params\.trigger !== SEASONAL_SMS_TRIGGERS\.received && params\.trigger !== expectedTrigger/);
});

test("전환은 계정 확인 뒤 알림 종류를 결정하고 빈 활성화 링크를 발송하지 않는다", () => {
  const conversion = route.slice(route.indexOf("async function convertApprovedItemToEnrollmentAndInvoice"), route.indexOf("async function issueAccountClaimForItem"));
  assert.ok(conversion.indexOf("issueParentAccountClaim") < conversion.indexOf("reserveSeasonalParentSms"));
  assert.match(conversion, /activation\.activationRequired && !activation\.activationUrl/);
  assert.match(conversion, /activationUrl: activation\.activationRequired \? publicUrl\(activation\.activationUrl!\) : ""/);
});

test("비활성 템플릿도 발송 경고와 일괄 실패 집계에 포함한다", () => {
  assert.match(route, /errorCode === "TEMPLATE_DISABLED_OR_MISSING"/);
  assert.match(route, /notificationsFailed: results\.filter\(\(result\) => result\.notificationWarning\)\.length/);
});

test("활성화 링크 교체와 발송 예약은 같은 트랜잭션이며 예약 실패는 링크도 롤백한다", () => {
  const helper = route.slice(route.indexOf("async function retryActivationSeasonalSms"), route.indexOf("async function retrySeasonalNotification"));
  assert.match(helper, /prisma\.\$transaction\(async \(tx\)/);
  assert.match(helper, /issueParentAccountClaim\([\s\S]*\}, tx\)/);
  assert.match(helper, /reserveSeasonalParentSms\(tx/);
  assert.match(helper, /reservation\.status !== "PENDING"[\s\S]*throw new SeasonalError/);
  assert.ok(helper.indexOf("issueParentAccountClaim") < helper.indexOf("reserveSeasonalParentSms"));
  assert.ok(helper.indexOf("reserveSeasonalParentSms") < helper.indexOf("dispatchSeasonalParentSms"));
});

test("계약 검증은 실제 SMS 공급자를 호출하지 않는다", () => {
  assert.doesNotMatch(route, /sendSmsDetailed\(/);
  assert.doesNotMatch(service, /sendSmsDetailed\(/);
});
