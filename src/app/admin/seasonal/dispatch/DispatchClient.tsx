"use client";

import { useState } from "react";
import RouteSection from "@/components/seasonal/RouteSection";
import { DocHead, DocButton, DocNotice, DocFoot, issuedAt } from "@/components/doc";
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
      <DocHead
        title="《방학특강 셔틀 배차 명세》"
        period={activeWeekdayLabel ? `${activeWeekdayLabel} 노선` : ""}
      />
      <div className="mt-4">
        {/* 조작 설명(요일 탭·드래그·기사 링크)은 화면에서 바로 보이므로 뺐다.
            "요일당 한 번만" 문장은 데이터 모델 설명(요일 단위 저장)이라 반드시 남긴다. */}
        <p className="m-0 text-[12.5px]" style={{ color: "var(--doc-ink-2)" }}>
          같은 요일은 같은 학생이 오므로 <b>요일당 한 번만</b> 짜서 저장하면 모든 같은 요일에 적용됩니다.
        </p>

        {/* 요일 탭 — 노선 관리 단위 */}
        <div className="no-print mt-3 flex flex-wrap items-center gap-5" style={{ borderBottom: "1px solid var(--doc-rule)" }}>
          {weekdays.length === 0 && <span className="py-2.5 text-[12.5px]" style={{ color: "var(--doc-ink-3)" }}>운행 요일이 없습니다.</span>}
          {weekdays.map((w) => {
            const on = date === w.canonicalDate;
            return (
              <button key={w.weekday} onClick={() => setDate(w.canonicalDate)}
                className="py-2.5 text-[12.5px] transition-colors"
                style={{
                  fontWeight: on ? 600 : 500,
                  color: on ? "var(--doc-accent)" : "var(--doc-ink-3)",
                  borderBottom: `2px solid ${on ? "var(--doc-accent)" : "transparent"}`,
                }}>
                {w.label}
              </button>
            );
          })}
        </div>

        {/* 기사님 링크 — 하나만 전달하면 매일 '오늘 운행'이 자동으로 뜬다(날짜별 생성 불필요). */}
        <div className="no-print mt-3 flex flex-wrap items-center gap-2">
          {/* 링크 설명문 제거 — 버튼 라벨과 복사 성공 토스트("매일 열면 오늘 운행")로 이미 두 번 안내된다 */}
          <DocButton onClick={copyRollingLink}>기사 운행 링크 복사</DocButton>
        </div>

        {err && <div className="mt-3"><DocNotice tone="error">{err}</DocNotice></div>}
        {msg && <div className="mt-2"><DocNotice tone="ok">{msg}</DocNotice></div>}

        {/* 하루 타임라인: 등원 → 하원 */}
        <div className="mt-2 space-y-3">
          <RouteSection initial={initialPickup} date={date} refreshKey={refreshKey} />
          <RouteSection initial={initialDropoff} date={date} refreshKey={refreshKey} />
        </div>
        <DocFoot issued={issuedAt()} />
      </div>
    </div>
  );
}
