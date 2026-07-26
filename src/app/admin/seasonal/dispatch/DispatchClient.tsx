"use client";

import { useState } from "react";
import RouteSection from "@/components/seasonal/RouteSection";
import { firstDateOfSameWeekday, weekdayOptions } from "@/lib/seasonal/weekday";
import type { DispatchSuggestion } from "@/lib/seasonal/shuttle-optimize";

// 방학특강 셔틀 배차 — 요일별로 관리한다. 요일 탭을 고르면 그 요일의 등원 → 하원 노선을 함께 보여준다.
// 같은 요일은 같은 학생이 오므로, 노선은 요일당 한 번만 짜서 저장하면 모든 같은 요일에 적용된다.
// 기준 위치(학원·차고지·거점) 편집은 '차량 관리'로 옮겼다.

export default function DispatchClient({ initialPickup, initialDropoff }: { initialPickup: DispatchSuggestion; initialDropoff: DispatchSuggestion }) {
  const availableDates = initialPickup.availableDates;
  const weekdays = weekdayOptions(availableDates); // 요일 탭(월→금) + 각 요일의 대표 날짜
  // 노선 관리용 날짜 = 선택한 요일의 '대표 날짜'(그 요일 첫 운행일). 초기값은 첫 운행일의 요일.
  const [date, setDate] = useState<string>(initialPickup.date ? firstDateOfSameWeekday(availableDates, initialPickup.date) : "");
  const refreshKey = 0; // 기준위치 편집이 이 화면에서 빠져 재계산 트리거가 없다(날짜 변경만으로 재조회).
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 기사 폰/태블릿에 고정하는 링크 — 매일 열면 '오늘' 운행이 뜬다.
  async function copyRollingLink() {
    setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/seasonal/dispatch/run-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rolling: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "링크 생성 실패");
      const url = `${window.location.origin}${j.path}`;
      try { await navigator.clipboard.writeText(url); setMsg("기사 고정 링크를 복사했습니다(매일 열면 오늘 운행)"); }
      catch { setMsg(`기사 고정 링크: ${url}`); }
    } catch (e: any) { setErr(e?.message || "링크를 만들지 못했습니다."); }
  }

  const activeWeekdayLabel = weekdays.find((w) => w.canonicalDate === date)?.label ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-base font-black text-gray-900 dark:text-white">셔틀 배차 · 하루 타임라인</h3>
        <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">
          <b>요일</b>을 고르면 그 요일의 <b>등원 → 하원</b> 노선을 함께 보여줍니다. 같은 요일은 같은 학생이 오므로 <b>요일당 한 번만</b> 짜서 저장하면 모든 같은 요일에 적용됩니다. 순서는 드래그(⠿)로 바꾸면 지도·시각이 실시간 재계산됩니다. 기사님 링크는 <b>하나</b>만 전달하면 매일 <b>그날 운행</b>이 자동으로 뜹니다.
        </p>

        {/* 요일 탭 — 노선 관리 단위 */}
        <div className="mt-3 flex flex-wrap items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900">
          {weekdays.length === 0 && <span className="px-2 py-1 text-sm font-bold text-gray-400">운행 요일이 없습니다.</span>}
          {weekdays.map((w) => (
            <button key={w.weekday} onClick={() => setDate(w.canonicalDate)}
              className={`min-h-9 rounded-lg px-4 text-sm font-black ${date === w.canonicalDate ? "bg-white text-brand-navy-900 shadow dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
              {w.label}
            </button>
          ))}
        </div>

        {/* 기사님 링크 — 하나만 전달하면 매일 '오늘 운행'이 자동으로 뜬다(날짜별 생성 불필요). */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={copyRollingLink} className="rounded-xl bg-brand-navy-900 px-4 py-2.5 text-sm font-black text-white dark:bg-brand-neon-lime dark:text-brand-navy-900">🚌 기사님 운행 링크 복사</button>
          <span className="text-[11.5px] text-gray-400">기사님 폰·태블릿에 이 링크 하나만 저장 → 매일 열면 그날 노선이 자동 표시</span>
        </div>

        {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">⚠ {err}</p>}
        {msg && <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-200">✓ {msg}</p>}

        <p className="mt-3 text-[12.5px] font-black text-gray-700 dark:text-gray-200">📅 {activeWeekdayLabel || "-"} 노선</p>

        {/* 하루 타임라인: 등원 → 하원 */}
        <div className="mt-2 space-y-3">
          <RouteSection initial={initialPickup} date={date} refreshKey={refreshKey} />
          <RouteSection initial={initialDropoff} date={date} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
