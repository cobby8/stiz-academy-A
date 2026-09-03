"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideEnrollmentChange, issueEnrollmentChangeInvoice } from "@/app/actions/enrollment-changes";
import { CHANGE_STATUS_LABEL } from "@/lib/enrollment/changeRequestRules";
import type { AdminChangeRequestRow } from "@/lib/enrollment/admin-change-request";

const FILTERS = [
  { value: "PENDING", label: "검토 중" },
  { value: "APPROVED", label: "승인" },
  { value: "REJECTED", label: "거절" },
  { value: "ALL", label: "전체" },
];

export default function EnrollmentChangesClient({
  rows,
  status,
}: {
  rows: AdminChangeRequestRow[];
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  function issueInvoice(requestId: string) {
    const row = rows.find(item => item.id === requestId);
    if (!row?.proration || !window.confirm(`${row.studentName} · ${row.effectiveFrom}\n${row.fromClassName} → ${row.toClassName}\n차액 ${row.proration.diff.toLocaleString()}원 사이트 청구서 1건을 생성할까요?\n문자·알림 발송과 시트·랠리즈 반영은 포함되지 않습니다.`)) return;
    setError("");
    startTransition(async () => {
      try {
      const result = await issueEnrollmentChangeInvoice(requestId, row.invoicePreviewKey);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      } catch {
        setError("청구 처리 결과를 확인하지 못했습니다. 새로고침하여 생성 여부를 확인한 뒤 다시 시도해 주세요.");
      }
    });
  }

  function decide(requestId: string, approve: boolean) {
    setError("");
    startTransition(async () => {
      const result = await decideEnrollmentChange({ requestId, approve, note: notes[requestId] });
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
        <h1 className="text-xl font-black text-brand-navy-900 dark:text-white">수강 변경 신청</h1>
        {/* 승인이 곧 반영이 아니라는 점을 먼저 알린다. 안 그러면 "승인했는데 왜 그대로냐"가 된다. */}
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          승인은 변경 접수 승인입니다. 적용일이 되면 시트·랠리즈·사이트 동기화 검토 대기로 등록되며, 세 시스템 확인 전에는 반이 바뀌거나 적용 완료로 표시되지 않습니다. 학부모 알림은 별도 승인 후 발송합니다.
        </p>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => router.push(`/admin/enrollment-changes?status=${item.value}`)}
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
          해당하는 신청이 없습니다
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
                <span className="text-xs font-bold text-gray-500">{CHANGE_STATUS_LABEL[row.status] ?? row.status}</span>
                {row.appliedAt && <span className="text-xs font-bold text-green-700">반영됨 {row.appliedAt}</span>}
              </div>

              <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                {row.fromClassName ?? "-"}
                {row.toClassName ? ` → ${row.toClassName}` : ""} · {row.effectiveFrom}부터
                {row.resumeOn ? ` · ${row.resumeOn} 복귀 예정` : ""}
              </p>

              {/* 정원은 신청 당시가 아니라 지금 기준으로 다시 센다. 그 사이 자리가 났을 수 있다. */}
              {row.toClassName && row.toClassFull && (
                <p className="mt-2 rounded-xl bg-amber-50 p-2 text-xs font-bold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  희망 반 정원이 지금도 차 있습니다{row.waitlisted ? " (신청 당시에도 마감)" : " (신청 당시에는 자리가 있었습니다)"}
                </p>
              )}
              {row.toClassName && !row.toClassFull && row.waitlisted && (
                <p className="mt-2 rounded-xl bg-green-50 p-2 text-xs font-bold text-green-800 dark:bg-green-950/30 dark:text-green-200">
                  신청 당시에는 마감이었지만 지금은 자리가 있습니다
                </p>
              )}

              {/* 일할 계산. 근거를 보여줘야 원장이 숫자를 믿고 발행할 수 있다.
                  금액은 발행 시 서버가 다시 계산한다(여기 숫자는 표시용). */}
              {row.proration && row.proration.needsProration && (
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                  <p className="text-xs font-black text-gray-700 dark:text-gray-200">수강료 일할 계산</p>
                  {row.proration.lines.map((line) => (
                    <p key={line} className="mt-1 text-xs text-gray-600 dark:text-gray-300">{line}</p>
                  ))}
                  {!row.proration.scheduleUnavailable && (
                    <p className="mt-2 text-sm font-black text-brand-navy-900 dark:text-white">
                      {row.proration.diff > 0
                        ? `추가 청구 ${row.proration.diff.toLocaleString()}원`
                        : row.proration.diff < 0
                          ? `${Math.abs(row.proration.diff).toLocaleString()}원은 다음 달 청구에서 차감하세요`
                          : "차액 없음"}
                    </p>
                  )}
                  {row.status === "APPROVED" && row.proration.diff > 0 && !row.proration.scheduleUnavailable && (
                    row.invoicedPaymentId ? (
                      <p className="mt-2 text-xs font-bold text-amber-700">차액 기록 있음 · 청구서 연결 및 시트·랠리즈 반영·알림은 별도 확인 필요</p>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => issueInvoice(row.id)}
                        className="mt-2 min-h-11 w-full rounded-xl bg-brand-navy-900 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-neon-lime dark:text-brand-navy-900"
                      >
                        차액 {row.proration.diff.toLocaleString()}원 사이트 청구서 생성
                      </button>
                    )
                  )}
                </div>
              )}

              {row.reason && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{row.reason}</p>}
              <p className="mt-2 text-xs text-gray-400">신청 {row.createdAt}</p>

              {row.status === "PENDING" ? (
                <div className="mt-3 space-y-2">
                  <input
                    value={notes[row.id] ?? ""}
                    onChange={(event) => setNotes((prev) => ({ ...prev, [row.id]: event.target.value }))}
                    maxLength={500}
                    placeholder="학부모에게 전할 말 (거절 시 함께 전달됩니다)"
                    className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(row.id, false)}
                      className="min-h-12 rounded-xl border border-gray-300 font-bold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
                    >
                      거절
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(row.id, true)}
                      className="min-h-12 rounded-xl bg-[var(--brand-accent)] font-black text-[var(--brand-accent-contrast)] disabled:opacity-50"
                    >
                      승인
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
