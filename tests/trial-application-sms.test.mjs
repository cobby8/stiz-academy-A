import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const publicAction = readFileSync(new URL("../src/app/actions/public.ts", import.meta.url), "utf8");
const adminAction = readFileSync(new URL("../src/app/actions/admin.ts", import.meta.url), "utf8");
const trialForm = readFileSync(new URL("../src/app/apply/trial/TrialApplicationForm.tsx", import.meta.url), "utf8");
const trialCrm = readFileSync(new URL("../src/app/admin/trial/TrialCrmClient.tsx", import.meta.url), "utf8");
const notification = readFileSync(new URL("../src/lib/notification.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("../src/lib/queries.ts", import.meta.url), "utf8");
const sms = readFileSync(new URL("../src/lib/sms.ts", import.meta.url), "utf8");

test("체험 신청은 한글 요일이 아니라 DB 슬롯키로 담당 코치 SMS를 매칭한다", () => {
  assert.match(publicAction, /TRIAL_DAY_KEY_BY_LABEL/);
  assert.match(publicAction, /월:\s*"Mon"/);
  assert.match(publicAction, /금:\s*"Fri"/);
  assert.match(publicAction, /function resolveTrialSlotKey/);
  assert.match(publicAction, /preferredSlotKey,\s*\/\/ preferredSlotKey/);
  assert.match(publicAction, /slotKeys:\s*preferredSlotKey \? \[preferredSlotKey\] : undefined/);
});

test("체험 신청 폼은 실제 빈자리 슬롯의 slotKey를 서버로 넘긴다", () => {
  assert.match(trialForm, /availableSlots/);
  assert.match(trialForm, /function getSlotPeriod/);
  assert.match(trialForm, /selectedSlot\?\.slotKey/);
  assert.match(trialForm, /slot\.startTime/);
});

test("체험 신청 SMS는 발송 장부에 성공과 실패를 남긴다", () => {
  assert.match(notification, /"NotificationDelivery"/);
  assert.match(notification, /channel,\s*"dedupeKey"/);
  assert.match(notification, /'SMS'/);
  assert.match(notification, /result\.ok \? "SENT" : "FAILED"/);
  assert.match(notification, /sendSmsDetailed/);
  assert.match(publicAction, /eventId:\s*trialLeadId/);
  assert.match(queries, /smsDeliveryTotal/);
  assert.match(queries, /sms_delivery/);
});

test("Solapi 요청은 일정 시간 안에 끝나도록 제한한다", () => {
  assert.match(sms, /SMS_REQUEST_TIMEOUT_MS/);
  assert.match(sms, /AbortController/);
  assert.match(sms, /signal:\s*controller\.signal/);
});

test("관리자는 실패한 체험 신청 문자만 다시 발송할 수 있다", () => {
  assert.match(notification, /export async function sendTrackedSms/);
  assert.match(notification, /deliveryRunId/);
  assert.match(adminAction, /export async function resendTrialApplicationSms/);
  assert.match(adminAction, /latest\.status = 'FAILED'/);
  assert.match(adminAction, /sendTrackedSms/);
  assert.match(trialCrm, /resendTrialApplicationSms/);
  assert.match(trialCrm, /실패 문자 재발송/);
});

test("체험 문자 배지는 과거 실패가 아니라 최신 발송 상태 기준으로 집계한다", () => {
  assert.match(queries, /SELECT DISTINCT ON \(\s*nd\."recipientPhone"/);
  assert.match(queries, /COUNT\(\*\) FILTER \(WHERE latest\.status = 'FAILED'\)/);
  assert.match(queries, /MAX\(latest\."updatedAt"\) AS sms_latest_at/);
});
