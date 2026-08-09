"use client";

import { useState } from "react";
import type { AdminCreditOverview } from "@/lib/makeup/admin-credits";

/** 만료 임박도에 따른 색. 원장이 목록을 훑을 때 눈으로 먼저 걸러진다. */
function urgency(daysLeft: number) {
  if (daysLeft < 0) return "text-red-600 dark:text-red-400";
  if (daysLeft <= 7) return "text-red-600 dark:text-red-400";
  if (daysLeft <= 14) return "text-amber-600 dark:text-amber-400";
  return "text-gray-500 dark:text-gray-400";
}

function daysText(d: number) {
  if (d < 0) return "기간 지남";
  if (d === 0) return "오늘까지";
  return `${d}일 남음`;
}

export default function CreditPanel({ data }: { data: AdminCreditOverview }) {
  const [openId, setOpenId] = useState("");
  const { totals, students } = data;

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-black text-gray-900 dark:text-gray-100">보강권 현황</h2>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            대상 <strong className="text-gray-900 dark:text-gray-100">{totals.students}</strong>명
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            미사용 <strong className="text-green-600 dark:text-green-400">{totals.available}</strong>장
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            예약됨 <strong className="text-blue-600 dark:text-blue-400">{totals.reserved}</strong>장
          </span>
          {totals.expiringSoon > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-black text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              2주 내 소멸 {totals.expiringSoon}장
            </span>
          )}
        </div>
      </div>

      {totals.expiringSoon > 0 && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          아직 예약하지 않은 보강권이 곧 소멸합니다. 미리 안내하면 분쟁을 막을 수 있습니다.
        </p>
      )}

      {students.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          남아 있는 보강권이 없습니다.
        </p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {students.map((s) => (
            <div key={s.studentId} className="py-2">
              <button
                type="button"
                onClick={() => setOpenId(openId === s.studentId ? "" : s.studentId)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="min-w-0 text-sm">
                  <span className="font-black text-gray-900 dark:text-gray-100">{s.studentName}</span>
                  {s.studentGrade && (
                    <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{s.studentGrade}</span>
                  )}
                  {s.parentPhone && (
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{s.parentPhone}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  {s.available > 0 && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 font-black text-green-700 dark:bg-green-900 dark:text-green-200">
                      미사용 {s.available}
                    </span>
                  )}
                  {s.reserved > 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 font-black text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                      예약 {s.reserved}
                    </span>
                  )}
                  <span className={`font-black ${urgency(s.soonestDaysLeft)}`}>
                    {daysText(s.soonestDaysLeft)}
                  </span>
                </div>
              </button>

              {openId === s.studentId && (
                <div className="mt-2 space-y-1.5 rounded-xl bg-gray-50 p-2.5 dark:bg-gray-900">
                  {s.credits.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="text-gray-600 dark:text-gray-300">
                        <span className="font-bold">{c.absenceLabel} 결석</span>
                        <span className="ml-1.5 text-gray-400 dark:text-gray-500">
                          {c.sourceLabel}
                          {c.originClassName ? ` · ${c.originClassName}` : ""}
                        </span>
                        {c.booking && (
                          <span className="ml-1.5 text-blue-600 dark:text-blue-400">→ {c.booking}</span>
                        )}
                      </div>
                      <span className={urgency(c.daysLeft)}>
                        {c.expiresLabel}까지 · {daysText(c.daysLeft)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
