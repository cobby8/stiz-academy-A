import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/enrollment/admin-change-request.ts', import.meta.url), 'utf8');

test('due changes are held in three-system ledger, not applied to website alone', () => {
  const due = source.slice(source.indexOf('export async function applyDueEnrollmentChanges'), source.indexOf('export async function issueProrationInvoice'));
  assert.match(due, /FOR UPDATE/);
  assert.match(due, /idempotencyKey: key/);
  assert.match(due, /\["SHEET", "RALLYZ", "WEBSITE"\]/);
  assert.match(due, /status: "HELD"/);
  assert.doesNotMatch(due, /UPDATE "Enrollment"|enrollment\.update|SET "appliedAt"/);
  assert.match(due, /enrollment\.studentId !== row\.studentId/);
  assert.match(due, /target\._count\.enrollments >= target\.capacity/);
  assert.match(due, /AND NOT EXISTS \(SELECT 1 FROM "OperationsCommand"/);
  assert.match(due, /student\.parentId === row\.requestedByUserId/);
  assert.match(due, /toClassId: row\.toClassId, parentConfirmed,/);
  assert.match(due, /AND NOT EXISTS \(SELECT 1 FROM "OperationsCommand"/);
  assert.match(due, /student\.parentId === row\.requestedByUserId/);
  assert.match(due, /toClassId: row\.toClassId, parentConfirmed,/);
});

test('decision does not send parent notifications', () => {
  assert.doesNotMatch(source, /notifyParentsOfStudents|notifyParentOfDecision/);
  assert.match(source, /ENROLLMENT_CHANGE_NOTIFICATION_HELD/);
});

test('proration locks request and atomically creates and links payment', () => {
  const invoice = source.slice(source.indexOf('export async function issueProrationInvoice'));
  assert.match(invoice, /return prisma\.\$transaction/);
  assert.match(invoice, /FOR UPDATE OF r/);
  assert.match(invoice, /tx\.\$queryRawUnsafe/);
  assert.match(invoice, /tx\.\$executeRawUnsafe/);
  assert.match(invoice, /if \(row\.invoicedPaymentId\)/);
  assert.match(invoice, /tx\.paymentInvoice\.create/);
  assert.match(invoice, /tx\.paymentAuditLog\.create/);
  assert.match(invoice, /input\.expectedPreviewKey !== invoicePreviewKey/);
  assert.match(invoice, /invoiceNo: `STIZ-CHANGE-/);
});
