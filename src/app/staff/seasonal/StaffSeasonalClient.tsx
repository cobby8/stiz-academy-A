"use client";

import { useCallback, useEffect, useState } from "react";

const ATT = [
  { key: "PRESENT", label: "출석", on: "bg-green-600 text-white" },
  { key: "LATE", label: "지각", on: "bg-amber-500 text-white" },
  { key: "ABSENT", label: "결석", on: "bg-red-600 text-white" },
];

async function getJSON(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "요청 실패");
  return j;
}

export default function StaffSeasonalClient({ initial }: { initial: any }) {
  const [ymd, setYmd] = useState<string>(initial.ymd);
  const [dates, setDates] = useState<any[]>(initial.dates || []);
  const [sel, setSel] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [err, setErr] = useState("");

  const loadDay = useCallback(async (d: string) => {
    setErr("");
    try { const data = await getJSON(`/api/staff/seasonal?date=${d}`); setDates(data.dates || []); setYmd(data.ymd); }
    catch (e) { setErr((e as Error).message); }
  }, []);

  const openDate = useCallback(async (row: any) => {
    setSel(row); setErr("");
    try { const data = await getJSON(`/api/staff/seasonal?sessionDateId=${row.sessionDateId}`); setRoster(data.rows || []); setMeta(data.date || null); }
    catch (e) { setErr((e as Error).message); }
  }, []);

  useEffect(() => { /* initial already loaded */ }, []);

  async function mark(row: any, status: string) {
    const next = row.attendanceStatus === status ? null : status;
    try {
      const r = await fetch("/api/staff/seasonal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "attendance", enrollmentDateId: row.enrollmentDateId, status: next }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error || "실패");
      setRoster((prev) => prev.map((x) => x.enrollmentDateId === row.enrollmentDateId ? { ...x, attendanceStatus: next } : x));
    } catch (e) { setErr((e as Error).message); }
  }

  function shiftDay(delta: number) {
    const d = new Date(ymd + "T00:00:00+09:00"); d.setDate(d.getDate() + delta);
    void loadDay(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d));
  }

  if (sel && meta) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <button onClick={() => { setSel(null); setMeta(null); void loadDay(ymd); }} className="mb-3 text-sm font-black text-gray-500">← 목록으로</button>
        <div className="mb-3">
          <div className="text-lg font-black">{meta.offeringTitle}</div>
          <div className="text-sm font-bold text-gray-500">{meta.dateLabel} ({meta.dayLabel}) · {meta.startTime}~{meta.endTime} · {roster.length}명</div>
        </div>
        {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-950 dark:text-red-300">{err}</div>}
        <div className="space-y-2">
          {roster.map((r) => (
            <div key={r.enrollmentDateId} className={`rounded-xl border p-3 dark:border-gray-700 ${r.kind === "MAKEUP" ? "border-violet-300 bg-violet-50 dark:bg-violet-950/40" : "border-gray-200 bg-white dark:bg-gray-800"}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-black">{r.childName}</span>
                <span className="text-xs font-bold text-gray-500">{r.childGrade || ""}</span>
                {r.kind === "MAKEUP" && <span className="rounded bg-violet-100 px-1 text-[10px] font-black text-violet-700 dark:bg-violet-900 dark:text-violet-200">보강생{r.originAbsence ? ` ←${r.originAbsence}` : ""}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ATT.map((a) => (
                  <button key={a.key} onClick={() => mark(r, a.key)}
                    className={`min-h-11 rounded-xl text-sm font-black ${r.attendanceStatus === a.key ? a.on : "border border-gray-200 text-gray-500 dark:border-gray-600"}`}>{a.label}</button>
                ))}
              </div>
            </div>
          ))}
          {roster.length === 0 && <div className="p-6 text-center text-sm text-gray-400">이 회차에 학생이 없습니다.</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-3 text-lg font-black">🏀 특강 출석</h1>
      <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
        <button onClick={() => shiftDay(-1)} className="min-h-9 px-3 font-black text-gray-500">‹</button>
        <span className="text-sm font-black">{ymd}</span>
        <button onClick={() => shiftDay(1)} className="min-h-9 px-3 font-black text-gray-500">›</button>
      </div>
      {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-950 dark:text-red-300">{err}</div>}
      <div className="space-y-2">
        {dates.map((d) => (
          <button key={d.sessionDateId} onClick={() => openDate(d)} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left dark:border-gray-700 dark:bg-gray-800">
            <div className="flex-1">
              <div className="font-black">{d.offeringTitle}</div>
              <div className="text-xs font-bold text-gray-500">{d.startTime}~{d.endTime} · {d.scheduled}명</div>
            </div>
            {d.unchecked > 0
              ? <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-black text-orange-600 dark:bg-orange-950">미확인 {d.unchecked}</span>
              : <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-black text-green-700 dark:bg-green-950 dark:text-green-300">완료</span>}
          </button>
        ))}
        {dates.length === 0 && <div className="p-6 text-center text-sm text-gray-400">이 날짜에 진행하는 특강이 없습니다.</div>}
      </div>
    </div>
  );
}
