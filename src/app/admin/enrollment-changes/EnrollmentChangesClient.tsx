"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideEnrollmentChange } from "@/app/actions/enrollment-changes";
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
          승인하면 적용일에 자동으로 반이 바뀝니다. 적용일이 지난 신청은 승인 즉시 반영됩니다.
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
