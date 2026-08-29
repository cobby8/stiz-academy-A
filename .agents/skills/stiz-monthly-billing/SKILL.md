---
name: stiz-monthly-billing
description: Reconcile and synchronize STIZ monthly enrollment, tuition, discounts, shuttle fees, invoices, and parent change requests across Google Sheets, Rallyz, and stiz-dasan.kr.
---

# STIZ Monthly Billing

Use this skill for monthly tuition review, parent-request processing, enrollment changes, and invoice preparation where Google Sheets, Rallyz, and `stiz-dasan.kr` must remain synchronized.

This repository copy is authoritative for STIZ work in this project. Do not copy a personal-machine version back over it without reviewing the diff and rerunning the repository tests.

## Non-negotiable invariant

Treat the three systems as one connected operating workflow:

- Google Sheets: temporary operational and fee-policy ledger.
- Rallyz: current external enrollment and invoice-delivery channel.
- `stiz-dasan.kr`: integration, validation, audit, and eventual source of truth.

Never finish after changing only one system. For each approved change, record the intended state for all three systems, apply every currently supported update, and report any unsupported or failed update as unresolved. A task is complete only after a three-way reconciliation or an explicit exception report.

## Choose the operating mode

- For monthly invoice review and issue, read [references/monthly-workflow.md](references/monthly-workflow.md) and [references/billing-policies.md](references/billing-policies.md).
- For pasted parent requests or enrollment changes, read [references/change-request-sync.md](references/change-request-sync.md) and [references/billing-policies.md](references/billing-policies.md).
- For website implementation or automation planning, read [references/integration-roadmap.md](references/integration-roadmap.md).

## Required safeguards

1. Start from the user's requested target month and the correct academy branch.
2. Build a dry-run change ledger before any external mutation. Each row must identify the student, effective month/date, change kind, and expected state in Sheet, Rallyz, and website.
3. Match students with stable identifiers when available. Do not rely on name alone for duplicates or similar names.
4. Separate automatic actions from `확인보류`. Stop on ambiguous identity, conflicting statuses, unknown class, unexplained fee, missing contact, duplicate invoice, or cross-system mismatch.
5. Before issuing/canceling invoices, sending notifications or invitations, deleting records, or transmitting personal information, show an action-time preview and stop. Identify exact recipients or records, before-and-after values, message or transaction content, and item count. Execute only after explicit approval of that preview.
6. Treat preparation and delivery as separate phases. Keep SMS, Kakao, email, push, Rallyz invoice notifications, and parent invitations `HELD` until the user approves the exact preview. If recipients, wording, values, or counts change, obtain approval again.
7. Do not issue zero-won invoices or invoices for excluded statuses.
8. After writes, re-read all three systems and compare counts, students, invoice rows, tuition, shuttle fees, discounts, periods, and totals.
9. Leave an audit result containing applied, skipped, held, and failed items. Never silently treat partial success as completion.
10. Only one operating computer or session with an explicit executor ID may own scheduled external reconciliation. Another computer defaults to read-only and dry-run until the handoff record names it `ACTIVE`. If the executor ID or previous-runner pause evidence is unknown, unattended external writes remain disabled.

## Transition policy

Until the user explicitly promotes the website to the sole source of truth, continue using and reconciling all three systems. Automation may reduce manual work, but it must not bypass the Sheet or Rallyz during this transition period.
