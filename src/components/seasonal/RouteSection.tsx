"use client";

import { useEffect, useRef, useState } from "react";
import { RouteMapCanvas } from "@/components/seasonal/DispatchRouteMap";
import type { DispatchSuggestion } from "@/lib/seasonal/shuttle-optimize";

// 한 방향(등원 또는 하원)의 노선 섹션 — 목록 + 지도 + 순서변경/재계산/무료탑승 드래그/출발조정/저장을 자립적으로 담는다.
// 날짜·기준위치가 바뀌면(refreshKey) 그 방향을 다시 계산한다.

function tel(p: string | null): string | null { if (!p) return null; const d = p.replace(/[^0-9]/g, ""); return d.length >= 9 ? `tel:${d}` : null; }
function parseHHMM(s: string | null): number | null { if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return null; const [h, m] = s.split(":").map(Number); return h * 60 + m; }
function fmtHHMM(mins: number): string { const v = ((Math.round(mins) % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`; }
function shiftHHMM(s: string | null, delta: number): string | null { const m = parseHHMM(s); return m == null ? s : fmtHHMM(m + delta); }
function shiftLabel(label: string | undefined, delta: number): string | undefined {
  if (!label) return label; const mt = label.match(/^(\d{1,2}:\d{2})(.*)$/); if (!mt) return label; return `${shiftHHMM(mt[1], delta)}${mt[2]}`;
}
function fmtSaved(iso: string): string {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("month")}/${g("day")} ${g("hour")}:${g("minute")}`;
}

const ROAD_FACTOR = 1.3, SPEED_KM_PER_MIN = 0.4;
const MIN_PER_KM = ROAD_FACTOR / SPEED_KM_PER_MIN;
const STOP_DWELL_MIN = 1.5, PICKUP_BUFFER_MIN = 10, DROPOFF_BUFFER_MIN = 5;
type Pt = { lat: number; lng: number };
function haversineKm(a: Pt, b: Pt): number {
  const R = 6371, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function segMin(a: Pt, b: Pt): number { return haversineKm(a, b) * MIN_PER_KM + STOP_DWELL_MIN; }

type Run = DispatchSuggestion["vehicles"][number];
function recomputeRunTimes(cur: DispatchSuggestion, run: Run, pinnedDepart?: string | null): Run {
  const isPickup = cur.direction === "PICKUP";
  const startPt: Pt = isPickup ? (cur.depot ?? cur.academy) : cur.academy;
  const endPt: Pt = isPickup ? cur.academy : (cur.depot ?? cur.academy);
  const order = run.stops;
  const path: Pt[] = [startPt, ...order, endPt];
  const segs: number[] = [];
  for (let i = 1; i < path.length; i++) segs.push(segMin(path[i - 1], path[i]));
  const sum = segs.reduce((a, b) => a + b, 0) || 1;
  const scale = run.tmapMinutes != null && run.tmapMinutes > 0 ? run.tmapMinutes / sum : 1;
  const seg = segs.map((s) => s * scale);
  const csMin = parseHHMM(cur.classStart), ceMin = parseHHMM(cur.classEnd);
  const times = new Array<number>(path.length).fill(0);
  const pinMin = pinnedDepart ? parseHHMM(pinnedDepart) : null;
  if (pinMin != null) {
    times[0] = pinMin;
    for (let i = 1; i < path.length; i++) times[i] = times[i - 1] + seg[i - 1];
  } else if (isPickup) {
    times[path.length - 1] = (csMin ?? 0) - PICKUP_BUFFER_MIN;
    for (let i = path.length - 2; i >= 0; i--) times[i] = times[i + 1] - seg[i];
  } else {
    times[0] = (ceMin ?? 0) + DROPOFF_BUFFER_MIN;
    for (let i = 1; i < path.length; i++) times[i] = times[i - 1] + seg[i - 1];
  }
  const stops = order.map((s, i) => ({ ...s, etaLabel: `${fmtHHMM(times[i + 1])} ${isPickup ? "승차" : "하차"}` }));
  return {
    ...run, stops,
    departTime: fmtHHMM(times[0]),
    arriveTime: fmtHHMM(times[path.length - 1]),
    depotTime: cur.depot ? fmtHHMM(isPickup ? times[0] : times[path.length - 1]) : null,
  };
}

export default function RouteSection({ initial, date, refreshKey }: { initial: DispatchSuggestion; date: string; refreshKey: number }) {
  const direction = initial.direction;
  const isPickup = direction === "PICKUP";
  const [sug, setSug] = useState<DispatchSuggestion>(initial);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [departPinned, setDepartPinned] = useState<Record<number, boolean>>({});
  const [mapVehicle, setMapVehicle] = useState<number>(0);
  const [rerouting, setRerouting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loadedFromSaved, setLoadedFromSaved] = useState(false);
  const [drag, setDrag] = useState<{ v: number; s: number } | null>(null);
  const [stuDrag, setStuDrag] = useState<{ v: number; s: number; i: number } | null>(null);
  const [hubBusy, setHubBusy] = useState(false);

  const sugRef = useRef(sug); sugRef.current = sug;
  const departPinnedRef = useRef(departPinned); departPinnedRef.current = departPinned;
  const rerouteTimer = useRef<number | null>(null);
  const dirtyVehicles = useRef<Set<number>>(new Set());
  const firstRun = useRef(true); // 첫 렌더는 서버가 준 initial을 쓰고 재조회하지 않는다(중복 T맵 방지).

  async function generate(forDate: string) {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/admin/seasonal/dispatch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, date: forDate || null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "실패");
      setSug(j); setDepartPinned({});
    } catch (e: any) { setErr(e?.message || "실패"); }
    finally { setLoading(false); }
  }

  async function loadAndApplySaved(forDate: string): Promise<boolean> {
    try {
      const r = await fetch(`/api/admin/seasonal/dispatch/saved?date=${encodeURIComponent(forDate)}&direction=${direction}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j?.saved) return false;
      const saved = j.saved as { vehicles: DispatchSuggestion["vehicles"]; classStart: string | null; classEnd: string | null; savedAt: string | null };
      setSug((cur) => ({ ...cur, date: forDate, vehicles: saved.vehicles, classStart: saved.classStart ?? cur.classStart, classEnd: saved.classEnd ?? cur.classEnd }));
      setSavedAt(saved.savedAt); setLoadedFromSaved(true); setDepartPinned({}); setErr(null); setSaveMsg(null);
      return true;
    } catch { return false; }
  }

  async function switchTo(forDate: string) {
    const applied = forDate ? await loadAndApplySaved(forDate) : false;
    if (!applied) { setLoadedFromSaved(false); setSaveMsg(null); await generate(forDate); }
  }

  // 날짜/기준위치 변경 시 이 방향을 다시 계산한다. 첫 렌더는 서버 initial을 그대로 쓴다.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    void switchTo(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, refreshKey]);

  async function saveRoute() {
    if (saving || !sug.date) return;
    setSaving(true); setSaveMsg(null); setErr(null);
    try {
      const r = await fetch("/api/admin/seasonal/dispatch/saved", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: sug.date, direction: sug.direction, vehicles: sug.vehicles, classStart: sug.classStart, classEnd: sug.classEnd }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "저장 실패");
      setSavedAt(j.savedAt ?? null); setLoadedFromSaved(true); setSaveMsg("저장했습니다");
    } catch (e: any) { setErr(e?.message || "노선을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  function reorderStop(vIdx: number, from: number, to: number) {
    setSug((cur) => {
      const vehicles = cur.vehicles.map((v) => ({ ...v, stops: [...v.stops] }));
      const stops = vehicles[vIdx].stops;
      if (from < 0 || from >= stops.length || to < 0 || to >= stops.length || from === to) return cur;
      const [moved] = stops.splice(from, 1);
      stops.splice(to, 0, moved);
      const pinnedDepart = departPinned[vIdx] ? vehicles[vIdx].departTime : null;
      vehicles[vIdx] = { ...recomputeRunTimes(cur, vehicles[vIdx], pinnedDepart), path: undefined };
      return { ...cur, vehicles };
    });
    scheduleReroute(vIdx);
  }

  function scheduleReroute(vIdx: number) {
    dirtyVehicles.current.add(vIdx);
    if (rerouteTimer.current) window.clearTimeout(rerouteTimer.current);
    rerouteTimer.current = window.setTimeout(() => { void runReroute(); }, 500);
  }
  async function runReroute() {
    const ids = [...dirtyVehicles.current]; dirtyVehicles.current.clear();
    if (ids.length === 0) return;
    setRerouting(true);
    try { for (const vIdx of ids) await rerouteVehicle(vIdx); }
    finally { setRerouting(false); }
  }
  async function rerouteVehicle(vIdx: number) {
    const cur = sugRef.current;
    const v = cur.vehicles[vIdx];
    if (!v || v.stops.length === 0) return;
    const startPt = isPickup ? (cur.depot ?? cur.academy) : cur.academy;
    const endPt = isPickup ? cur.academy : (cur.depot ?? cur.academy);
    try {
      const r = await fetch("/api/admin/seasonal/dispatch/reroute", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: { lat: startPt.lat, lng: startPt.lng }, end: { lat: endPt.lat, lng: endPt.lng }, waypoints: v.stops.map((s) => ({ lat: s.lat, lng: s.lng })) }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.path) return;
      setSug((prev) => {
        if (!prev.vehicles[vIdx]) return prev;
        const vehicles = prev.vehicles.map((vv, i) => (i !== vIdx ? vv
          : { ...vv, path: j.path as { lat: number; lng: number }[], tmapMinutes: j.totalMinutes ?? vv.tmapMinutes, tmapKm: j.totalKm ?? vv.tmapKm, provider: "TMAP" as const }));
        vehicles[vIdx] = recomputeRunTimes(prev, vehicles[vIdx], departPinnedRef.current[vIdx] ? vehicles[vIdx].departTime : null);
        return { ...prev, vehicles };
      });
    } catch { /* 유지 */ }
  }

  async function moveStudentToHub(vIdx: number, sIdx: number, stuIdx: number) {
    const st = sug.vehicles[vIdx]?.stops[sIdx]?.students[stuIdx];
    if (!st || hubBusy) return;
    setHubBusy(true); setErr(null);
    try {
      const target = st.rosterId ? { rosterId: st.rosterId } : { requestId: st.requestId };
      const newLabel = `무료탑승 · ${(st.pickupLabel || st.name).replace(/^무료탑승\s*·?\s*/, "")}`;
      const r = await fetch("/api/admin/seasonal/shuttle-roster", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, patch: { pickupLocation: newLabel } }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "저장 실패");
      await generate(sug.date ?? date);
    } catch (e: any) { setErr(e?.message || "무료탑승으로 옮기지 못했습니다."); }
    finally { setHubBusy(false); }
  }

  function setDepartTime(vIdx: number, newDepart: string) {
    setDepartPinned((p) => ({ ...p, [vIdx]: true }));
    setSug((cur) => {
      const vehicles = cur.vehicles.map((v, i) => {
        if (i !== vIdx) return v;
        const oldMin = parseHHMM(v.departTime), newMin = parseHHMM(newDepart);
        if (oldMin == null || newMin == null) return v;
        const delta = newMin - oldMin;
        if (delta === 0) return v;
        return { ...v, departTime: shiftHHMM(v.departTime, delta), arriveTime: shiftHHMM(v.arriveTime, delta), depotTime: shiftHHMM(v.depotTime, delta), stops: v.stops.map((s) => ({ ...s, etaLabel: shiftLabel(s.etaLabel, delta) })) };
      });
      return { ...cur, vehicles };
    });
  }

  const activeMapIdx = sug.vehicles.length ? Math.min(Math.max(mapVehicle, 0), sug.vehicles.length - 1) : 0;
  const mapStartPt = isPickup ? (sug.depot ?? sug.academy) : sug.academy;
  const mapEndPt = isPickup ? sug.academy : (sug.depot ?? sug.academy);
  const sectionTime = isPickup ? sug.classStart : sug.classEnd;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      {/* 섹션 헤더: 시간 · 방향 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className={`grid h-8 w-8 place-items-center rounded-xl text-lg ${isPickup ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200"}`}>{isPickup ? "⬆" : "⬇"}</span>
          <div>
            <p className="text-[15px] font-black text-gray-900 dark:text-white">{sectionTime ?? "-"} · {isPickup ? "등원" : "하원"}</p>
            <p className="text-[11.5px] font-bold text-gray-500">{sug.classStart ?? "-"}{sug.classEnd ? `~${sug.classEnd}` : ""} 수업 · 탑승 {sug.totalRiders}명{rerouting ? " · 🔄 경로 재계산…" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 print:hidden">
          <button onClick={() => { setLoadedFromSaved(false); setSaveMsg(null); void generate(date); }} disabled={loading} className="rounded-lg bg-brand-navy-900 px-2.5 py-1.5 text-[12px] font-black text-white disabled:opacity-50 dark:bg-brand-neon-lime dark:text-brand-navy-900">{loading ? "계산 중…" : "⚡ 자동 제안"}</button>
          <button onClick={saveRoute} disabled={saving || sug.vehicles.length === 0} className="rounded-lg bg-brand-orange-500 px-2.5 py-1.5 text-[12px] font-black text-white disabled:opacity-50">{saving ? "저장 중…" : "💾 저장"}</button>
        </div>
      </div>

      {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">⚠ {err}</p>}
      {loadedFromSaved && <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-[11.5px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">💾 저장된 노선{savedAt ? ` · ${fmtSaved(savedAt)} 저장` : ""} · 「자동 제안」으로 새로 계산</p>}
      {saveMsg && <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-[11.5px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-200">✓ {saveMsg}</p>}

      {sug.vehicles.length === 0 && <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">이 날짜에 배차할 {isPickup ? "등원" : "하원"} 셔틀 학생이 없습니다.</div>}

      <div className="mt-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        <div className="grid min-w-0 gap-3">
          {sug.vehicles.map((v, vIdx) => (
            <div key={vIdx} className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between bg-brand-navy-900 px-4 py-2.5 text-white">
                <span className="font-black">🚐 {v.vehicleName}{v.tripLabel ? ` · ${v.tripLabel}` : ""}</span>
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => setMapVehicle(vIdx)} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold hover:bg-white/25 print:hidden">🗺 지도</button>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${v.over ? "bg-red-500" : "bg-white/15"}`}>{v.passengers} / {v.capacity}명</span>
                </span>
              </div>
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] font-bold dark:border-gray-700 dark:bg-gray-900/50">
                {v.provider === "TMAP"
                  ? <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">T맵 실도로</span>
                  : <span className="rounded bg-gray-200 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">직선 추정</span>}
                {v.tmapMinutes != null && <span className="text-gray-500">약 {v.tmapMinutes}분{v.tmapKm != null ? ` · ${v.tmapKm}km` : ""}</span>}
              </div>
              <ol className="divide-y divide-gray-100 dark:divide-gray-700">
                <li className="flex items-center gap-2.5 bg-gray-50/60 px-3 py-2 dark:bg-gray-900/40">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-gray-600 text-[11px] text-white">{isPickup ? "🚏" : "🏫"}</span>
                  <span className="text-[12px] font-bold text-gray-600 dark:text-gray-300">{isPickup ? (sug.depot ? `${sug.depot.name.replace(/^차고지 · /, "차고지 ")} 출발` : "출발") : `${sug.academy.name} 출발`}</span>
                  <label className="ml-auto flex items-center gap-1 text-[11px] font-bold text-gray-500 print:hidden">
                    출발
                    <input type="time" value={v.departTime ?? ""} onChange={(e) => setDepartTime(vIdx, e.target.value)} className="rounded-lg border border-gray-200 px-1.5 py-0.5 text-[11.5px] font-black text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                  {v.departTime && <span className="hidden text-[11.5px] font-black text-gray-500 print:inline">{v.departTime} 출발</span>}
                </li>
                {v.stops.map((s, sIdx) => (
                  <li key={sIdx}
                    onDragOver={(e) => { if (drag && drag.v === vIdx) e.preventDefault(); else if (stuDrag && s.isHub) e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (drag && drag.v === vIdx && drag.s !== sIdx) reorderStop(vIdx, drag.s, sIdx);
                      else if (stuDrag && s.isHub) moveStudentToHub(stuDrag.v, stuDrag.s, stuDrag.i);
                      setDrag(null); setStuDrag(null);
                    }}
                    className={`flex items-start gap-2 px-3 py-2.5 ${s.isHub ? "bg-green-50/70 dark:bg-green-900/15" : ""} ${drag && drag.v === vIdx && drag.s === sIdx ? "opacity-40" : ""} ${stuDrag && s.isHub ? "ring-2 ring-inset ring-green-400" : ""}`}>
                    <span draggable onDragStart={(e) => { setDrag({ v: vIdx, s: sIdx }); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDrag(null)} title="드래그해서 순서 변경" className="mt-0.5 shrink-0 cursor-move select-none text-base leading-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 print:hidden">⠿</span>
                    <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black text-white ${s.isHub ? "bg-green-600" : "bg-brand-orange-500"}`}>{s.isHub ? "🆓" : sIdx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-gray-900 dark:text-white">
                        {s.label}
                        {s.isHub
                          ? <>
                              <span className="ml-1 rounded bg-green-600 px-1.5 text-[10px] font-black text-white">무료 탑승 거점</span>
                              {s.students.length > 0 && <span className="ml-1 rounded bg-lime-200 px-1.5 text-[10px] font-black text-brand-navy-900">{s.students.length}명</span>}
                            </>
                          : <span className="ml-1 rounded bg-lime-200 px-1.5 text-[10px] font-black text-brand-navy-900">{s.students.length}명</span>}
                        {s.approx && !s.isHub && <span className="ml-1 rounded bg-amber-100 px-1.5 text-[10px] font-black text-amber-700">추정</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11.5px] text-gray-500">
                        {s.isHub ? (
                          <>
                            {s.students.map((st, i) => { const t = tel(st.parentPhone); return <span key={i} className="font-bold text-green-800 dark:text-green-200">{st.name}{st.grade ? `·${st.grade}` : ""}{t && <a href={t} draggable={false} className="ml-0.5 text-green-600">📞</a>}</span>; })}
                            <span className="text-green-700 dark:text-green-300">학생을 여기로 끌어다 놓으면 무료 거점 {isPickup ? "탑승" : "하차"}으로 지정됩니다 · 워크인 정원 별도</span>
                          </>
                        ) : (
                          s.students.map((st, i) => {
                            const t = tel(st.parentPhone);
                            return <span key={i} draggable onDragStart={(e) => { setStuDrag({ v: vIdx, s: sIdx, i }); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setStuDrag(null)} title="드래그해서 무료 거점으로 이동" className="cursor-grab select-none rounded px-0.5 hover:bg-lime-100 dark:hover:bg-lime-900/30">
                              {st.name}{st.grade ? `·${st.grade}` : ""}{t && <a href={t} draggable={false} className="ml-0.5 font-bold text-green-600">📞</a>}</span>;
                          })
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 print:hidden">
                      {s.etaLabel && <span className="whitespace-nowrap text-[11.5px] font-black text-blue-600 dark:text-blue-300 print:text-black">{s.etaLabel}</span>}
                    </div>
                    {s.etaLabel && <span className="hidden whitespace-nowrap text-[11.5px] font-black text-black print:inline">{s.etaLabel}</span>}
                  </li>
                ))}
                <li className="flex items-center gap-2.5 bg-gray-50 px-3 py-2.5 dark:bg-gray-900">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-navy-900 text-[11px] text-white">{isPickup ? "🏫" : "🚏"}</span>
                  <span className="text-[12.5px] font-bold text-gray-700 dark:text-gray-200">{isPickup ? `${sug.academy.name} 도착` : (sug.depot ? `${sug.depot.name.replace(/^차고지 · /, "차고지 ")} 복귀` : "복귀")}</span>
                  {isPickup && v.arriveTime && <span className="ml-auto text-[11.5px] font-black text-gray-500">{v.arriveTime} 도착</span>}
                  {!isPickup && v.depotTime && <span className="ml-auto text-[11.5px] font-black text-gray-500">{v.depotTime} 복귀</span>}
                </li>
              </ol>
            </div>
          ))}
        </div>

        {sug.vehicles.length > 0 && (
          <aside className="mt-3 lg:mt-0 lg:sticky lg:top-4 print:hidden">
            <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between gap-2 bg-brand-navy-900 px-3 py-2 text-white">
                <span className="text-xs font-black">🗺 {isPickup ? "등원" : "하원"} 경로{rerouting ? " · 🔄" : ""}</span>
                {sug.vehicles.length > 1 && (
                  <select value={activeMapIdx} onChange={(e) => setMapVehicle(Number(e.target.value))} className="rounded bg-white/15 px-2 py-1 text-[11px] font-bold text-white">
                    {sug.vehicles.map((v, i) => <option key={i} value={i} className="text-black">{v.vehicleName}{v.tripLabel ? ` ${v.tripLabel}` : ""}</option>)}
                  </select>
                )}
              </div>
              <RouteMapCanvas
                start={{ lat: mapStartPt.lat, lng: mapStartPt.lng, label: isPickup ? "차고지" : "학원" }}
                end={{ lat: mapEndPt.lat, lng: mapEndPt.lng, label: isPickup ? "학원" : "차고지" }}
                stops={sug.vehicles[activeMapIdx].stops.map((s, i) => ({ lat: s.lat, lng: s.lng, label: s.label, badge: s.isHub ? "무료" : String(i + 1), kind: s.isHub ? "hub" : "stop" }))}
                path={sug.vehicles[activeMapIdx].path}
                heightClass="h-[46vh] lg:h-[52vh]"
              />
            </div>
          </aside>
        )}
      </div>

      {sug.unassigned.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="text-[12.5px] font-black text-amber-800 dark:text-amber-200">⚠ 좌표가 없어 배차하지 못한 학생 {sug.unassigned.length}명</div>
          <div className="mt-1 text-[12px] text-amber-700 dark:text-amber-200">{sug.unassigned.map((u) => `${u.name}(${u.label ?? "위치없음"})`).join(", ")}</div>
        </div>
      )}
    </section>
  );
}
