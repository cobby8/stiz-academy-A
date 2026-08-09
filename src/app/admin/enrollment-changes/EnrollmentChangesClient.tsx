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
    setError("");
    startTransition(async () => {
      const result = await issueEnrollmentChangeInvoice(requestId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
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
        <h1 className="text-xl font-bold text-[var(--doc-ink)]">수강 변경 신청</h1>
        {/* 승인이 곧 반영이 아니라는 점을 먼저 알린다. 안 그러면 "승인했는데 왜 그대로냐"가 된다. */}
        <p className="mt-1 text-sm text-[var(--doc-ink-2)]">
          승인하면 적용일에 자동으로 반이 바뀝니다. 적용일이 지난 신청은 승인 즉시 반영됩니다.
        </p>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => router.push(`/admin/enrollment-changes?status=${item.value}`)}
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
          해당하는 신청이 없습니다
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
                <span className="text-xs font-bold text-[var(--doc-ink-2)]">{CHANGE_STATUS_LABEL[row.status] ?? row.status}</span>
                {row.appliedAt && <span className="text-xs font-bold text-[var(--doc-accent)]">반영됨 {row.appliedAt}</span>}
              </div>

              <p className="mt-2 text-sm text-[var(--doc-ink-2)]">
                {row.fromClassName ?? "-"}
                {row.toClassName ? ` → ${row.toClassName}` : ""} · {row.effectiveFrom}부터
                {row.resumeOn ? ` · ${row.resumeOn} 복귀 예정` : ""}
              </p>

              {/* 정원은 신청 당시가 아니라 지금 기준으로 다시 센다. 그 사이 자리가 났을 수 있다. */}
              {row.toClassName && row.toClassFull && (
                <p className="mt-2 rounded-[3px] bg-[var(--doc-grid-head)] p-2 text-xs font-bold text-[var(--doc-warn)]">
                  희망 반 정원이 지금도 차 있습니다{row.waitlisted ? " (신청 당시에도 마감)" : " (신청 당시에는 자리가 있었습니다)"}
                </p>
              )}
              {row.toClassName && !row.toClassFull && row.waitlisted && (
                <p className="mt-2 rounded-[3px] bg-[var(--doc-accent-soft)] p-2 text-xs font-bold text-[var(--doc-accent)]">
                  신청 당시에는 마감이었지만 지금은 자리가 있습니다
                </p>
              )}

              {/* 일할 계산. 근거를 보여줘야 원장이 숫자를 믿고 발행할 수 있다.
                  금액은 발행 시 서버가 다시 계산한다(여기 숫자는 표시용). */}
              {row.proration && row.proration.needsProration && (
                <div className="mt-3 rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-grid-head)] p-3">
                  <p className="text-xs font-bold text-[var(--doc-ink-2)]">수강료 일할 계산</p>
                  {row.proration.lines.map((line) => (
                    <p key={line} className="mt-1 text-xs text-[var(--doc-ink-2)]">{line}</p>
                  ))}
                  {!row.proration.scheduleUnavailable && (
                    <p className="mt-2 text-sm font-bold text-[var(--doc-ink)]">
                      {row.proration.diff > 0
                        ? `추가 청구 ${row.proration.diff.toLocaleString()}원`
                        : row.proration.diff < 0
                          ? `${Math.abs(row.proration.diff).toLocaleString()}원은 다음 달 청구에서 차감하세요`
                          : "차액 없음"}
                    </p>
                  )}
                  {row.status === "APPROVED" && row.proration.diff > 0 && !row.proration.scheduleUnavailable && (
                    row.invoicedPaymentId ? (
                      <p className="mt-2 text-xs font-bold text-[var(--doc-accent)]">차액 청구서 발행됨</p>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => issueInvoice(row.id)}
                        className="mt-2 min-h-11 w-full rounded-[3px] bg-[var(--doc-ink)] text-sm font-bold text-white disabled:opacity-50 dark:text-[var(--doc-ink)]"
                      >
                        차액 {row.proration.diff.toLocaleString()}원 청구서 만들기
                      </button>
                    )
                  )}
                </div>
              )}

              {row.reason && <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--doc-ink-2)]">{row.reason}</p>}
              <p className="mt-2 text-xs text-[var(--doc-ink-3)]">신청 {row.createdAt}</p>

              {row.status === "PENDING" ? (
                <div className="mt-3 space-y-2">
                  <input
                    value={notes[row.id] ?? ""}
                    onChange={(event) => setNotes((prev) => ({ ...prev, [row.id]: event.target.value }))}
                    maxLength={500}
                    placeholder="학부모에게 전할 말 (거절 시 함께 전달됩니다)"
                    className="min-h-11 w-full rounded-[3px] border border-[var(--doc-rule)] px-3 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(row.id, false)}
                      className="min-h-12 rounded-[3px] border border-[var(--doc-rule)] font-bold text-[var(--doc-ink-2)] disabled:opacity-50"
                    >
                      거절
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(row.id, true)}
                      className="min-h-12 rounded-[3px] bg-[var(--doc-accent)] font-bold text-[var(--doc-on-accent)] disabled:opacity-50"
                    >
                      승인
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
