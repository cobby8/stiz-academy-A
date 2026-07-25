"use client";

import { useCallback, useState } from "react";

const STATUS_LABEL: Record<string, string> = { REQUESTED: "신청 접수 (승인 대기)", SCHEDULED: "보강 확정", ATTENDED: "보강 완료", NO_SHOW: "미출석" };

export default function SeasonalMakeupClient({ initial }: { initial: any }) {
  const [ctx, setCtx] = useState<any>(initial);
  const [open, setOpen] = useState<string>("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try { const r = await fetch("/api/mypage/seasonal-makeup", { cache: "no-store" }); const j = await r.json(); if (r.ok) setCtx(j); }
    catch { /* noop */ }
  }, []);

  async function request(enrollmentDateId: string, targetType: string, target: any) {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const body: any = { enrollmentDateId, targetType };
      if (targetType === "SEASONAL") body.targetSessionDateId = target.sessionDateId;
      else { body.targetClassId = target.classId; body.targetDate = target.nextDate; }
      const r = await fetch("/api/mypage/seasonal-makeup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error || "신청 실패");
      setMsg("보강 신청이 접수되었습니다. 학원 승인 후 확정됩니다."); setOpen(""); await reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (!ctx.phoneKnown) {
    return <div className="mx-auto max-w-lg p-4"><h1 className="mb-2 text-lg font-black">방학특강 보강</h1><div className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500 dark:bg-gray-900">계정에 등록된 전화번호로 신청 내역을 찾을 수 없습니다. 학원에 문의해 주세요.</div></div>;
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-1 text-lg font-black">🏀 방학특강 보강 신청</h1>
      <p className="mb-4 text-xs font-bold text-gray-500">결석한 수업을 다른 날짜로 보강 신청할 수 있어요. (결석일로부터 2개월 이내)</p>

      {msg && <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-bold text-green-700 dark:bg-green-950 dark:text-green-300">{msg}</div>}
      {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-950 dark:text-red-300">{err}</div>}

      <div className="mb-2 text-sm font-black">보강이 필요한 결석</div>
      <div className="space-y-2">
        {(ctx.absences || []).map((ab: any) => (
          <div key={ab.enrollmentDateId} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="font-black">{ab.childName} <span className="text-xs font-bold text-gray-500">· {ab.offeringTitle}</span></div>
                <div className="text-xs font-bold text-red-600">{ab.absentLabel} 결석</div>
              </div>
              <button onClick={() => setOpen(open === ab.enrollmentDateId ? "" : ab.enrollmentDateId)}
                className="min-h-9 rounded-lg bg-[var(--brand-accent)] px-3 text-xs font-black text-[var(--brand-accent-contrast)]">{open === ab.enrollmentDateId ? "닫기" : "보강 신청"}</button>
            </div>
            {open === ab.enrollmentDateId && (
              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                <div className="mb-1 text-xs font-black text-gray-500">① 같은 특강 다른 날짜</div>
                {ab.seasonalCandidates.length === 0 && <div className="mb-2 text-xs text-gray-400">여유 있는 날짜가 없습니다.</div>}
                <div className="mb-2 flex flex-wrap gap-2">
                  {ab.seasonalCandidates.map((s: any) => (
                    <button key={s.sessionDateId} disabled={busy} onClick={() => request(ab.enrollmentDateId, "SEASONAL", s)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-black hover:border-[var(--brand-accent)] disabled:opacity-50 dark:border-gray-600">{s.label} <span className="text-gray-400">여유{s.remaining}</span></button>
                  ))}
                </div>
                {ab.regularCandidates.length > 0 && <>
                  <div className="mb-1 mt-2 text-xs font-black text-gray-500">② 정규수업 보강 (추천)</div>
                  <div className="flex flex-wrap gap-2">
                    {ab.regularCandidates.map((c: any) => (
                      <button key={c.classId} disabled={busy} onClick={() => request(ab.enrollmentDateId, "REGULAR", c)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-black hover:border-[var(--brand-accent)] disabled:opacity-50 dark:border-gray-600">
                        <div>{c.nextLabel} · {c.name}</div><div className="font-bold text-gray-400">{c.schedule}</div>
                      </button>
                    ))}
                  </div>
                </>}
                <p className="mt-2 text-[11px] font-bold text-gray-400">신청 후 학원 승인 시 확정됩니다.</p>
              </div>
            )}
          </div>
        ))}
        {(ctx.absences || []).length === 0 && <div className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500 dark:bg-gray-900">현재 보강이 필요한 결석이 없습니다.</div>}
      </div>

      {(ctx.makeups || []).length > 0 && <>
        <div className="mb-2 mt-6 text-sm font-black">보강 신청 현황</div>
        <div className="space-y-2">
          {ctx.makeups.map((m: any) => (
            <div key={m.id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex-1">
                <div className="font-black">{m.childName} <span className="text-xs font-bold text-gray-500">· {m.offeringTitle}</span></div>
                <div className="text-xs font-bold text-gray-500">{m.absentLabel} 결석 → {m.targetLabel || (m.targetType === "REGULAR" ? "정규수업" : "-")}</div>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-black ${m.status === "REQUESTED" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : m.status === "ATTENDED" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"}`}>{STATUS_LABEL[m.status] || m.status}</span>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}
