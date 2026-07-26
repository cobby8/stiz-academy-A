"use client";

import { useState } from "react";
import LocationPickerModal, { type MapLocationData } from "@/components/maps/LocationPickerModal";
import RouteSection from "@/components/seasonal/RouteSection";
import type { DispatchSuggestion } from "@/lib/seasonal/shuttle-optimize";

// 방학특강 셔틀 배차 — 한 날짜의 타임라인(등원 → 하원 섹션)을 함께 보여준다.
// 상단에서 날짜·기준위치(학원/차고지/1호점)를 고르면 두 섹션이 함께 갱신된다.

type Geo = { lat: number; lng: number; name: string } | null;
type GeoKind = "academy" | "depot" | "hub";
const GEO_META: Record<GeoKind, { title: string; icon: string }> = {
  academy: { title: "학원", icon: "🏫" },
  depot: { title: "차고지", icon: "🚏" },
  hub: { title: "1호점(무료 탑승)", icon: "🆓" },
};

export default function DispatchClient({ initialPickup, initialDropoff }: { initialPickup: DispatchSuggestion; initialDropoff: DispatchSuggestion }) {
  const [date, setDate] = useState<string>(initialPickup.date ?? "");
  const [geo, setGeo] = useState<{ academy: Geo; depot: Geo; hub: Geo }>({ academy: initialPickup.academy, depot: initialPickup.depot, hub: initialPickup.hub });
  const [editKind, setEditKind] = useState<GeoKind | null>(null);
  const [savingGeo, setSavingGeo] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const availableDates = initialPickup.availableDates;

  function geoOf(kind: GeoKind) {
    const g = geo[kind];
    return g ? { label: g.name.replace(/^(STIZ 다산점 · |차고지 · )/, ""), lat: g.lat, lng: g.lng } : null;
  }

  async function saveGeo(kind: GeoKind, loc: MapLocationData) {
    setSavingGeo(true); setErr(null);
    try {
      const r = await fetch("/api/admin/seasonal/shuttle-settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, latitude: loc.latitude, longitude: loc.longitude, address: loc.roadAddress ?? loc.address }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "저장 실패");
      setGeo((g) => ({ ...g, [kind]: { lat: loc.latitude, lng: loc.longitude, name: loc.roadAddress ?? loc.address } }));
      setEditKind(null);
      setRefreshKey((k) => k + 1); // 두 섹션 재계산
    } catch (e: any) { setErr(e?.message || "저장 실패"); }
    finally { setSavingGeo(false); }
  }

  // 그 날짜의 기사님 전용 링크(등원·하원 모두 포함)를 만들어 클립보드에 복사한다.
  async function copyRunLink() {
    if (!date) return;
    setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/seasonal/dispatch/run-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "링크 생성 실패");
      const url = `${window.location.origin}${j.path}`;
      try { await navigator.clipboard.writeText(url); setMsg("기사님 링크를 복사했습니다(그 날 등원·하원 전체)"); }
      catch { setMsg(`기사님 링크: ${url}`); }
    } catch (e: any) { setErr(e?.message || "링크를 만들지 못했습니다."); }
  }

  const dow = availableDates.find((d) => d.date === date)?.label ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-base font-black text-gray-900 dark:text-white">셔틀 배차 · 하루 타임라인</h3>
        <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">
          날짜를 고르면 그 날 <b>등원 → 하원</b> 노선을 함께 보여줍니다. 각 구간의 순서는 드래그(⠿)로 바꾸면 지도·시각이 실시간으로 다시 계산됩니다. 무료 거점에 학생을 끌어다 넣을 수 있고, 조정한 노선은 구간별로 저장됩니다.
        </p>

        {/* 기준 위치 편집 */}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(Object.keys(GEO_META) as GeoKind[]).map((kind) => {
            const g = geoOf(kind); const m = GEO_META[kind];
            return (
              <div key={kind} className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-900/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-gray-500">{m.icon} {m.title}</span>
                  <button onClick={() => setEditKind(kind)} className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-bold text-brand-orange-600 hover:bg-white dark:border-gray-600 dark:text-brand-neon-lime">지도에서 변경</button>
                </div>
                <div className="mt-1 truncate text-[12px] font-bold text-gray-800 dark:text-gray-200">{g ? g.label : "미설정"}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-bold text-gray-500">날짜
            <select value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white">
              {availableDates.length === 0 && <option value="">-</option>}
              {availableDates.map((d) => <option key={d.date} value={d.date}>{d.label}</option>)}
            </select>
          </label>
          <button onClick={copyRunLink} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-bold text-gray-700 dark:border-gray-600 dark:text-gray-200">🔗 기사님 링크</button>
          <button onClick={() => window.print()} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 dark:border-gray-600 dark:text-gray-200">🖨 인쇄</button>
        </div>

        {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">⚠ {err}</p>}
        {msg && <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-200">✓ {msg}</p>}

        <p className="mt-3 text-[12.5px] font-black text-gray-700 dark:text-gray-200">📅 {dow || date || "-"}</p>

        {/* 하루 타임라인: 등원 → 하원 */}
        <div className="mt-2 space-y-3">
          <RouteSection initial={initialPickup} date={date} refreshKey={refreshKey} />
          <RouteSection initial={initialDropoff} date={date} refreshKey={refreshKey} />
        </div>
      </div>

      {editKind && (
        <LocationPickerModal
          title={`${GEO_META[editKind].title} 위치 변경`}
          initialValue={(() => { const g = geoOf(editKind); return g ? { address: g.label, latitude: g.lat, longitude: g.lng, source: "MAP_PIN" } : undefined; })()}
          confirmPending={savingGeo}
          onConfirm={(loc) => saveGeo(editKind, loc)}
          onClose={() => setEditKind(null)}
        />
      )}
    </div>
  );
}
