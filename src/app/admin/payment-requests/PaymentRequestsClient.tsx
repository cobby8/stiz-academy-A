"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decidePaymentRequest } from "@/app/actions/payment-requests";
import { PAYMENT_REQUEST_STATUS_LABEL } from "@/lib/payments/parentRequestRules";
import type { AdminPaymentRequestRow } from "@/lib/payments/admin-payment-request";

const FILTERS = [
  { value: "PENDING", label: "확인 중" },
  { value: "DONE", label: "처리 완료" },
  { value: "REJECTED", label: "확인 안 됨" },
  { value: "ALL", label: "전체" },
];

export default function PaymentRequestsClient({
  rows,
  status,
}: {
  rows: AdminPaymentRequestRow[];
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  function decide(requestId: string, approve: boolean) {
    setError("");
    startTransition(async () => {
      const result = await decidePaymentRequest({
        requestId,
        approve,
        note: notes[requestId],
        receiptUrl: receipts[requestId],
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-[var(--doc-ink)]">입금 확인·영수증 요청</h1>
        {/* 승인이 곧 납부 처리라는 점을 먼저 알린다. */}
        <p className="mt-1 text-sm text-[var(--doc-ink-2)]">
          입금 확인을 승인하면 <b>바로 납부 처리</b>됩니다. 통장·랠리즈에서 대조한 뒤 눌러 주세요.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => router.push(`/admin/payment-requests?status=${item.value}`)}
            className={`min-h-11 rounded-[3px] px-4 text-sm font-bold ${
 status === item.value
 ? "bg-[var(--doc-ink)] text-white dark:text-[var(--doc-ink)]"
 : "border border-[var(--doc-rule)] bg-[var(--doc-surface)] text-[var(--doc-ink-2)] "
 }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-[3px] bg-[var(--doc-crit-soft)] p-3 text-sm font-bold text-[var(--doc-crit)]">{error}</p>}

      {rows.length === 0 ? (
        <p className="rounded-[6px] bg-[var(--doc-surface)] p-8 text-center text-sm text-[var(--doc-ink-3)]">
          해당하는 요청이 없습니다
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-base">{row.studentName}</strong>
                <span className="rounded-[3px] bg-[var(--doc-grid-head)] px-2 py-0.5 text-xs font-bold text-[var(--doc-ink-2)]">
                  {row.kindLabel}
                </span>
                <span className="text-xs font-bold text-[var(--doc-ink-2)]">
                  {PAYMENT_REQUEST_STATUS_LABEL[row.status] ?? row.status}
                </span>
              </div>

              <p className="mt-2 text-sm text-[var(--doc-ink-2)]">
                {row.description || "수강료"} · {row.amount.toLocaleString()}원
                {row.dueDate ? ` · ${row.dueDate}까지` : ""}
              </p>

              {/* 통장에서 대조할 단서를 한 줄로 모아 보여준다. */}
              {row.kind === "PAYMENT_CLAIM" && (
                <p className="mt-2 rounded-[3px] bg-[var(--doc-grid-head)] p-2 text-sm font-bold text-[var(--doc-warn)]">
                  {row.paidOn} · {row.methodLabel}
                  {row.depositorName ? ` · 입금자 ${row.depositorName}` : ""}
                </p>
              )}
              {row.kind === "RECEIPT" && (
                <p className="mt-2 rounded-[3px] bg-[var(--doc-grid-head)] p-2 text-sm font-bold text-[var(--doc-ink-2)]">
                  {row.receiptTypeLabel} · {row.receiptTarget}
                </p>
              )}

              {row.note && <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--doc-ink-2)]">{row.note}</p>}
              <p className="mt-2 text-xs text-[var(--doc-ink-3)]">요청 {row.createdAt}</p>

              {row.status === "PENDING" ? (
                <div className="mt-3 space-y-2">
                  {row.kind === "RECEIPT" && (
                    <input
                      value={receipts[row.id] ?? ""}
                      onChange={(event) => setReceipts((prev) => ({ ...prev, [row.id]: event.target.value }))}
                      maxLength={500}
                      placeholder="영수증 링크 (있으면 붙여넣기 — 학부모 화면에 '영수증 보기'로 뜹니다)"
                      className="min-h-11 w-full rounded-[3px] border border-[var(--doc-rule)] px-3 text-sm"
                    />
                  )}
                  <input
                    value={notes[row.id] ?? ""}
                    onChange={(event) => setNotes((prev) => ({ ...prev, [row.id]: event.target.value }))}
                    maxLength={500}
                    placeholder="학부모에게 전할 말 (확인 안 됨으로 처리할 때 함께 전달됩니다)"
                    className="min-h-11 w-full rounded-[3px] border border-[var(--doc-rule)] px-3 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(row.id, false)}
                      className="min-h-12 rounded-[3px] border border-[var(--doc-rule)] font-bold text-[var(--doc-ink-2)] disabled:opacity-50"
                    >
                      확인 안 됨
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(row.id, true)}
                      className="min-h-12 rounded-[3px] bg-[var(--doc-accent)] font-bold text-[var(--doc-on-accent)] disabled:opacity-50"
                    >
                      {row.kind === "PAYMENT_CLAIM" ? "확인 · 납부 처리" : "발급 완료"}
                    </button>
                  </div>
                </div>
              ) : (
                row.decisionNote && (
                  <p className="mt-2 rounded-[3px] bg-[var(--doc-grid-head)] p-2 text-xs text-[var(--doc-ink-2)]">
                    메모: {row.decisionNote}
                  </p>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
