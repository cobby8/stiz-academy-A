"use client";

import { useState } from "react";
import type { AdminCreditOverview } from "@/lib/makeup/admin-credits";

/** 만료 임박도에 따른 색. 원장이 목록을 훑을 때 눈으로 먼저 걸러진다. */
function urgency(daysLeft: number) {
  if (daysLeft < 0) return "text-[var(--doc-crit)] ";
  if (daysLeft <= 7) return "text-[var(--doc-crit)] ";
  if (daysLeft <= 14) return "text-[var(--doc-warn)] ";
  return "text-[var(--doc-ink-2)] ";
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
    <div className="mb-6 rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[var(--doc-ink)]">보강권 현황</h2>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="text-[var(--doc-ink-2)]">
            대상 <strong className="text-[var(--doc-ink)]">{totals.students}</strong>명
          </span>
          <span className="text-[var(--doc-ink-2)]">
            미사용 <strong className="text-[var(--doc-accent)]">{totals.available}</strong>장
          </span>
          <span className="text-[var(--doc-ink-2)]">
            예약됨 <strong className="text-[var(--doc-ink-2)]">{totals.reserved}</strong>장
          </span>
          {totals.expiringSoon > 0 && (
            <span className="rounded-[3px] bg-[var(--doc-grid-head)] px-2 py-0.5 font-bold text-[var(--doc-warn)]">
              2주 내 소멸 {totals.expiringSoon}장
            </span>
          )}
        </div>
      </div>

      {totals.expiringSoon > 0 && (
        <p className="mb-3 rounded-[3px] bg-[var(--doc-grid-head)] px-3 py-2 text-xs text-[var(--doc-warn)]">
          아직 예약하지 않은 보강권이 곧 소멸합니다. 미리 안내하면 분쟁을 막을 수 있습니다.
        </p>
      )}

      {students.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--doc-ink-2)]">
          남아 있는 보강권이 없습니다.
        </p>
      ) : (
        <div className="divide-y divide-[var(--doc-rule)]">
          {students.map((s) => (
            <div key={s.studentId} className="py-2">
              <button
                type="button"
                onClick={() => setOpenId(openId === s.studentId ? "" : s.studentId)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="min-w-0 text-sm">
                  <span className="font-bold text-[var(--doc-ink)]">{s.studentName}</span>
                  {s.studentGrade && (
                    <span className="ml-1.5 text-xs text-[var(--doc-ink-3)]">{s.studentGrade}</span>
                  )}
                  {s.parentPhone && (
                    <span className="ml-2 text-xs text-[var(--doc-ink-3)]">{s.parentPhone}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  {s.available > 0 && (
                    <span className="rounded-[3px] bg-[var(--doc-accent-soft)] px-2 py-0.5 font-bold text-[var(--doc-accent)]">
                      미사용 {s.available}
                    </span>
                  )}
                  {s.reserved > 0 && (
                    <span className="rounded-[3px] bg-[var(--doc-grid-head)] px-2 py-0.5 font-bold text-[var(--doc-ink-2)]">
                      예약 {s.reserved}
                    </span>
                  )}
                  <span className={`font-bold ${urgency(s.soonestDaysLeft)}`}>
                    {daysText(s.soonestDaysLeft)}
                  </span>
                </div>
              </button>

              {openId === s.studentId && (
                <div className="mt-2 space-y-1.5 rounded-[3px] bg-[var(--doc-grid-head)] p-2.5">
                  {s.credits.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="text-[var(--doc-ink-2)]">
                        <span className="font-bold">{c.absenceLabel} 결석</span>
                        <span className="ml-1.5 text-[var(--doc-ink-3)]">
                          {c.sourceLabel}
                          {c.originClassName ? ` · ${c.originClassName}` : ""}
                        </span>
                        {c.booking && (
                          <span className="ml-1.5 text-[var(--doc-ink-2)]">→ {c.booking}</span>
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
