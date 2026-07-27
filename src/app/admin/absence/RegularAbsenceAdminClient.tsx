"use client";

import { useCallback, useMemo, useState } from "react";
import type { RegularAbsenceRow, RegularAbsenceClassOption } from "@/lib/regular/admin-regular-absence";
import {
  confirmRegularAbsence,
  revertRegularAbsence,
  cancelRegularAbsenceByAdmin,
  loadRegularAbsences,
} from "@/app/actions/regular-absence-admin";

export default function RegularAbsenceAdminClient({
  initial,
}: {
  initial: { rows: RegularAbsenceRow[]; classes: RegularAbsenceClassOption[] };
}) {
  const [rows, setRows] = useState<RegularAbsenceRow[]>(initial.rows);
  const [classId, setClassId] = useState<string>(""); // "" = 전체 반
  const [busyId, setBusyId] = useState<string>("");
  const [err, setErr] = useState("");

  const reload = useCallback(async (cid: string) => {
    setErr("");
    try {
      const res = await loadRegularAbsences({ classId: cid || undefined });
      setRows(res.rows);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  const onClassChange = useCallback(
    (cid: string) => {
      setClassId(cid);
      void reload(cid);
    },
    [reload],
  );

  const runAction = useCallback(
    async (id: string, fn: (i: { id: string }) => Promise<unknown>) => {
      setErr("");
      setBusyId(id);
      try {
        await fn({ id });
        await reload(classId);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusyId("");
      }
    },
    [reload, classId],
  );

  const reportedCount = useMemo(() => rows.filter((r) => r.status === "REPORTED").length, [rows]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* 헤더 + 반 필터 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-gray-900 dark:text-gray-100">
            <span className="material-symbols-outlined text-2xl text-[var(--brand-accent)]">event_busy</span>
            정규 수업 결석
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            학부모가 미리 신고한 정규수업 결석을 확인하고 확정합니다. (방학특강 결석은 별도 메뉴)
            {reportedCount > 0 && (
              <span className="ml-1 font-bold text-amber-600 dark:text-amber-400">미확정 {reportedCount}건</span>
            )}
          </p>
        </div>
        <select
          value={classId}
          onChange={(e) => onClassChange(e.target.value)}
          className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">전체 반</option>
          {initial.classes.map((c) => (
            <option key={c.classId} value={c.classId}>
              {c.className}
            </option>
          ))}
        </select>
      </div>

      {err && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {err}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          접수된 정규수업 결석 신고가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const busy = busyId === r.id;
            const confirmed = r.status === "CONFIRMED";
            return (
              <div
                key={r.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* 좌: 학생·반·날짜·사유 */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black text-gray-900 dark:text-gray-100">{r.studentName}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{r.className}</span>
                      {confirmed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-black text-green-700 dark:bg-green-950 dark:text-green-300">
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          {r.statusLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          {r.statusLabel}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-bold">{r.dateLabel}</span>
                      <span className="ml-2 text-gray-400">{r.startTime}</span>
                      <span className="ml-2">· 사유: {r.reasonLabel}</span>
                      {r.reportedAtLabel && (
                        <span className="ml-2 text-gray-400 dark:text-gray-500">· 신고 {r.reportedAtLabel}</span>
                      )}
                    </div>
                  </div>

                  {/* 우: 확정 / 확정취소 / 취소 */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {confirmed ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(r.id, revertRegularAbsence)}
                        className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <span className="material-symbols-outlined text-lg">undo</span>확정 취소
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(r.id, confirmRegularAbsence)}
                        className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[var(--brand-accent)] px-3 text-sm font-black text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-lg">check</span>확정
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction(r.id, cancelRegularAbsenceByAdmin)}
                      title="신고 취소(무효 처리)"
                      className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 text-sm font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
