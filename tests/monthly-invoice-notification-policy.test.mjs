import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const adminAction = readFileSync("src/app/actions/admin.ts", "utf8");
const financeClient = readFileSync("src/app/admin/finance/FinanceClient.tsx", "utf8");
const policySource = readFileSync("src/lib/billing/notification-policy.ts", "utf8");

const policyModule = { exports: {} };
new Function("module", "exports", ts.transpile(policySource, {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
}))(policyModule, policyModule.exports);
const { isMonthlyInvoiceNotificationEligible } = policyModule.exports;

test("월 청구 생성은 0원 템플릿을 원장에 만들지 않는다", () => {
  const targetSql = adminAction.slice(
    adminAction.indexOf("const MONTHLY_INVOICE_TARGETS_SQL"),
    adminAction.indexOf("export async function previewMonthlyInvoices"),
  );

  assert.match(targetSql, /WHERE "isActive" = true\s+AND amount > 0/);
});

test("학부모 청구 알림은 0원과 명시적 HELD 건을 제외한다", () => {
  const sendAction = adminAction.slice(
    adminAction.indexOf("export async function sendInvoiceLinksForMonth"),
    adminAction.indexOf("export async function sendUnpaidReminders"),
  );

  assert.match(sendAction, /AND p\.amount > 0/);
  assert.match(sendAction, /command\.status = 'HELD'/);
  assert.match(sendAction, /command\."notificationStatus" = 'HELD'/);
  assert.match(sendAction, /AND i\."sentAt" IS NULL/);
  assert.equal(isMonthlyInvoiceNotificationEligible({ amount: 130000, notificationHeld: false }), true);
  assert.equal(isMonthlyInvoiceNotificationEligible({ amount: 0, notificationHeld: false }), false);
  assert.equal(isMonthlyInvoiceNotificationEligible({ amount: 130000, notificationHeld: true }), false);
});

test("청구 생성과 알림 발송은 별도 승인으로 유지하면서 발송 의무를 안내한다", () => {
  assert.match(financeClient, /링크 발송 \(필수\)/);
  assert.match(financeClient, /별도 승인 후 발송/);
  assert.match(financeClient, /0원·보류 건을 제외한 청구서는 링크 발송이 필수/);

  const generateAt = financeClient.indexOf("generateMonthlyInvoices(year, month");
  const sendAt = financeClient.indexOf("sendInvoiceLinksForMonth(year, month)");
  assert.ok(generateAt >= 0 && sendAt > generateAt, "생성과 발송 함수는 분리되어야 합니다.");
});
