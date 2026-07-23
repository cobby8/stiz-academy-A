import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const notification = fs.readFileSync("src/lib/notification.ts", "utf8");
const adminAction = fs.readFileSync("src/app/actions/admin.ts", "utf8");
const trialClient = fs.readFileSync("src/app/admin/trial/TrialCrmClient.tsx", "utf8");
const applyModals = fs.readFileSync("src/app/admin/apply/ApplyAdminModals.tsx", "utf8");

test("업무용 학부모 문자는 기존 void 계약과 분리해 실제 결과를 반환한다", () => {
    assert.match(notification, /export async function sendParentSmsWithResult/);
    assert.match(notification, /Promise<SmsSendResult>/);
    assert.match(notification, /WHERE "NotificationDelivery"\.status = 'FAILED'/);
    assert.match(notification, /결과 장부 확정에 실패했습니다\. 자동 재전송하지 말고 공급자 내역을 확인/);
});

test("미납 알림은 성공한 결제만 완료 시각과 횟수를 갱신한다", () => {
    assert.match(adminAction, /successfulPaymentIds\.push\(\.\.\.info\.paymentIds\)/);
    assert.match(adminAction, /if \(successfulPaymentIds\.length > 0\)/);
    assert.match(adminAction, /failed = unpaid\.length - successfulPaymentIds\.length/);
    assert.match(adminAction, /eventId: `unpaid:\$\{info\.paymentIds/);
});

test("체험 완료 문자는 성공한 경우에만 발송 완료 시각을 기록하고 실패를 화면에 알린다", () => {
    assert.match(adminAction, /if \(smsResult\.ok\) \{[\s\S]*?"attendedSmsSentAt"/);
    assert.match(adminAction, /eventId: `trial:\$\{id\}:attended`/);
    assert.match(trialClient, /상태는 변경됐지만 문자 발송은 실패했습니다/);
    assert.match(trialClient, /상세 보기에서 '완료 문자 재시도'/);
    assert.match(adminAction, /message: smsResult\.ok[\s\S]*smsResult\.reason/);
    assert.match(adminAction, /export async function resendTrialAttendedSms/);
    assert.match(trialClient, /완료 문자 재시도/);
});

test("수강 승인은 유지하면서 학부모와 코치 문자 실패를 관리자에게 돌려준다", () => {
    assert.match(adminAction, /eventId: `enrollment-application:\$\{applicationId\}:approved`/);
    assert.match(adminAction, /smsResult\.coachFailed = staffDelivery\.coachFailed/);
    assert.match(adminAction, /smsResult\.adminFailed = staffDelivery\.adminFailed/);
    assert.match(applyModals, /result\.sms\.adminFailed > 0/);
    assert.match(adminAction, /requireMatchedCoach: true/);
    assert.match(notification, /FROM "ScheduleSlot" ss/);
    assert.match(notification, /승인된 반에 담당 코치 슬롯이 지정되지 않았습니다/);
    assert.match(notification, /throw new Error\("담당 코치 조회에 실패했습니다/);
    assert.doesNotMatch(notification, /\[getCoachPhonesBySlotKeys\] failed:"[\s\S]{0,100}return \[\]/);
    assert.match(adminAction, /return \{ approved: true, sms: smsResult \}/);
    assert.match(applyModals, /수강신청은 승인됐지만 일부 문자가 발송되지 않았습니다/);
});

test("미납 알림은 강제 재발송 인자를 받지 않아 실제 미발송 건만 횟수를 올린다", () => {
    assert.match(adminAction, /export async function sendUnpaidReminders\(\)/);
    assert.doesNotMatch(adminAction, /sendUnpaidReminders\(forceResend/);
});
