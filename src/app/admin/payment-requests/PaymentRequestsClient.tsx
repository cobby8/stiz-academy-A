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
        <h1 className="text-xl font-black text-brand-navy-900 dark:text-white">입금 확인·영수증 요청</h1>
        {/* 승인이 곧 납부 처리라는 점을 먼저 알린다. */}
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          입금 확인을 승인하면 <b>바로 납부 처리</b>됩니다. 통장·랠리즈에서 대조한 뒤 눌러 주세요.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => router.push(`/admin/payment-requests?status=${item.value}`)}
            className={`min-h-11 rounded-xl px-4 text-sm font-bold ${
              status === item.value
                ? "bg-brand-navy-900 text-white dark:bg-brand-neon-lime dark:text-brand-navy-900"
                : "border border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm dark:bg-gray-900">
          해당하는 요청이 없습니다
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-base dark:text-white">{row.studentName}</strong>
                <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  {row.kindLabel}
                </span>
                <span className="text-xs font-bold text-gray-500">
                  {PAYMENT_REQUEST_STATUS_LABEL[row.status] ?? row.status}
                </span>
              </div>

              <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                {row.description || "수강료"} · {row.amount.toLocaleString()}원
                {row.dueDate ? ` · ${row.dueDate}까지` : ""}
              </p>

              {/* 통장에서 대조할 단서를 한 줄로 모아 보여준다. */}
              {row.kind === "PAYMENT_CLAIM" && (
                <p className="mt-2 rounded-xl bg-amber-50 p-2 text-sm font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  {row.paidOn} · {row.methodLabel}
                  {row.depositorName ? ` · 입금자 ${row.depositorName}` : ""}
                </p>
              )}
              {row.kind === "RECEIPT" && (
                <p className="mt-2 rounded-xl bg-blue-50 p-2 text-sm font-bold text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  {row.receiptTypeLabel} · {row.receiptTarget}
                </p>
              )}

              {row.note && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{row.note}</p>}
              <p className="mt-2 text-xs text-gray-400">요청 {row.createdAt}</p>

              {row.status === "PENDING" ? (
                <div className="mt-3 space-y-2">
                  {row.kind === "RECEIPT" && (
                    <input
                      value={receipts[row.id] ?? ""}
                      onChange={(event) => setReceipts((prev) => ({ ...prev, [row.id]: event.target.value }))}
                      maxLength={500}
                      placeholder="영수증 링크 (있으면 붙여넣기 — 학부모 화면에 '영수증 보기'로 뜹니다)"
                      className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800"
                    />
                  )}
                  <input
                    value={notes[row.id] ?? ""}
                    onChange={(event) => setNotes((prev) => ({ ...prev, [row.id]: event.target.value }))}
                    maxLength={500}
                    placeholder="학부모에게 전할 말 (확인 안 됨으로 처리할 때 함께 전달됩니다)"
                    className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(row.id, false)}
                      className="min-h-12 rounded-xl border border-gray-300 font-bold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
                    >
                      확인 안 됨
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(row.id, true)}
                      className="min-h-12 rounded-xl bg-[var(--brand-accent)] font-black text-[var(--brand-accent-contrast)] disabled:opacity-50"
                    >
                      {row.kind === "PAYMENT_CLAIM" ? "확인 · 납부 처리" : "발급 완료"}
                    </button>
                  </div>
                </div>
              ) : (
                row.decisionNote && (
                  <p className="mt-2 rounded-xl bg-gray-50 p-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
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
