"use client";

import { useState } from "react";
import LocationPickerModal, { type MapLocationData } from "@/components/maps/LocationPickerModal";
import type { DispatchSuggestion } from "@/lib/seasonal/shuttle-optimize";

// 방학특강 셔틀 노선 자동 제안 화면.
// 날짜(요일 반복 스케줄)와 방향을 고르면 그 날 등원하는 셔틀 학생만 등록 차량 정원에 맞춰 배차한다.
// 기준 위치(학원·차고지·1호점)는 상단에서 지도로 손쉽게 변경할 수 있다.

function tel(p: string | null): string | null { if (!p) return null; const d = p.replace(/[^0-9]/g, ""); return d.length >= 9 ? `tel:${d}` : null; }

// 출발 시각 수동 조정용 시간 유틸. 시각은 전부 'HH:MM' 문자열로 다룬다.
function parseHHMM(s: string | null): number | null {
  if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return null;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
function fmtHHMM(mins: number): string {
  const v = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}
function shiftHHMM(s: string | null, delta: number): string | null {
  const m = parseHHMM(s);
  return m == null ? s : fmtHHMM(m + delta);
}
// "09:20 승차" 같은 라벨의 앞 시각만 delta분 이동시킨다.
function shiftLabel(label: string | undefined, delta: number): string | undefined {
  if (!label) return label;
  const mt = label.match(/^(\d{1,2}:\d{2})(.*)$/);
  if (!mt) return label;
  return `${shiftHHMM(mt[1], delta)}${mt[2]}`;
}

// 순서를 바꾸면 시각을 다시 배분한다 — 서버 planRun과 같은 상수·기준을 그대로 쓴다(되돌리면 원래 시각과 일치).
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
// 한 차량의 현재 정차 순서로 승·하차 시각(등원=학원 도착, 하원=학원 출발 기준)을 다시 계산한다.
// T맵 총 소요시간이 있으면 그 값을 새 순서의 거리 비율로 재배분한다(서버와 동일 공식).
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
    // 사람이 출발 시각을 고정함 → 출발에서 앞으로 배분(도착은 파생). 순서를 바꿔도 출발이 유지된다.
    times[0] = pinMin;
    for (let i = 1; i < path.length; i++) times[i] = times[i - 1] + seg[i - 1];
  } else if (isPickup) {
    times[path.length - 1] = (csMin ?? 0) - PICKUP_BUFFER_MIN; // 학원 도착 기준 역산
    for (let i = path.length - 2; i >= 0; i--) times[i] = times[i + 1] - seg[i];
  } else {
    times[0] = (ceMin ?? 0) + DROPOFF_BUFFER_MIN; // 학원 출발
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

type GeoKind = "academy" | "depot" | "hub";
const GEO_META: Record<GeoKind, { title: string; icon: string }> = {
  academy: { title: "학원", icon: "🏫" },
  depot: { title: "차고지", icon: "🚏" },
  hub: { title: "1호점(무료 탑승)", icon: "🆓" },
};

export default function DispatchClient({ initial }: { initial: DispatchSuggestion }) {
  const [sug, setSug] = useState<DispatchSuggestion>(initial);
  const [direction, setDirection] = useState<"PICKUP" | "DROPOFF">(initial.direction);
  const [date, setDate] = useState<string>(initial.date ?? "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<GeoKind | null>(null);
  const [savingGeo, setSavingGeo] = useState(false);
  // 사람이 출발 시각을 직접 맞춘 차량 index. 이 차량은 순서를 바꿔도 출발 시각을 유지한다.
  const [departPinned, setDepartPinned] = useState<Record<number, boolean>>({});

  async function saveGeo(kind: GeoKind, loc: MapLocationData) {
    setSavingGeo(true); setErr(null);
    try {
      const r = await fetch("/api/admin/seasonal/shuttle-settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, latitude: loc.latitude, longitude: loc.longitude, address: loc.roadAddress ?? loc.address }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "저장 실패");
      setEditKind(null);
      await generate(); // 새 기준 위치로 노선 재계산
    } catch (e: any) { setErr(e?.message || "저장 실패"); }
    finally { setSavingGeo(false); }
  }

  function geoOf(kind: GeoKind) {
    const g = kind === "academy" ? sug.academy : kind === "depot" ? sug.depot : sug.hub;
    return g ? { label: g.name.replace(/^(STIZ 다산점 · |차고지 · )/, ""), lat: g.lat, lng: g.lng } : null;
  }

  async function generate(next?: Partial<{ direction: "PICKUP" | "DROPOFF"; date: string }>) {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/admin/seasonal/dispatch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: next?.direction ?? direction, date: next?.date ?? (date || null) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "실패");
      setSug(j);
      setDepartPinned({}); // 새로 제안하면 출발 고정도 초기화
    } catch (e: any) { setErr(e?.message || "실패"); }
    finally { setLoading(false); }
  }

  function moveStop(vIdx: number, sIdx: number, dir: -1 | 1) {
    reorderStop(vIdx, sIdx, sIdx + dir);
  }

  // 정차 순서 변경(위/아래 버튼과 드래그앤드롭이 공통으로 쓴다).
  function reorderStop(vIdx: number, from: number, to: number) {
    setSug((cur) => {
      const vehicles = cur.vehicles.map((v) => ({ ...v, stops: [...v.stops] }));
      const stops = vehicles[vIdx].stops;
      if (from < 0 || from >= stops.length || to < 0 || to >= stops.length || from === to) return cur;
      const [moved] = stops.splice(from, 1);
      stops.splice(to, 0, moved);
      // ★ 순서가 바뀌었으니 그 차량의 승·하차 시각을 다시 계산한다(예전엔 최초 시각이 그대로 남았다).
      // 사람이 출발 시각을 맞춰 둔 차량이면 그 출발을 고정해 유지한다(초기화 방지).
      const pinnedDepart = departPinned[vIdx] ? vehicles[vIdx].departTime : null;
      vehicles[vIdx] = recomputeRunTimes(cur, vehicles[vIdx], pinnedDepart);
      return { ...cur, vehicles };
    });
  }

  // 드래그 중인 정차 위치(차량 index + 정차 index). 같은 차량 안에서만 순서를 바꾼다.
  const [drag, setDrag] = useState<{ v: number; s: number } | null>(null);

  // 무료탑승 거점으로 끌어 넣는 중인 학생(차량·정차·학생 index). 정차 순서 드래그(drag)와 별개다.
  const [stuDrag, setStuDrag] = useState<{ v: number; s: number; i: number } | null>(null);
  const [hubBusy, setHubBusy] = useState(false);

  // 학생을 무료탑승 거점으로 옮긴다 — 그 학생의 승차위치 이름표에 '무료탑승 ·'을 붙여 확정 명단에 저장한다.
  // 좌표는 지우지 않는다(되돌릴 때 안전). 저장 후 재계산하면 그 학생이 거점 정류장에 붙어 표시된다.
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
      await generate(); // 확정 명단이 바뀌었으니 노선을 다시 계산해 거점에 반영
    } catch (e: any) { setErr(e?.message || "무료탑승으로 옮기지 못했습니다."); }
    finally { setHubBusy(false); }
  }

  // 출발 시각 직접 조정 — 첫 노드(등원=차고지 / 하원=학원) 출발을 바꾸면 그 차량 전체 시각이 같이 이동한다.
  function setDepartTime(vIdx: number, newDepart: string) {
    setDepartPinned((p) => ({ ...p, [vIdx]: true })); // 이 차량은 출발 고정으로 표시
    setSug((cur) => {
      const vehicles = cur.vehicles.map((v, i) => {
        if (i !== vIdx) return v;
        const oldMin = parseHHMM(v.departTime), newMin = parseHHMM(newDepart);
        if (oldMin == null || newMin == null) return v;
        const delta = newMin - oldMin;
        if (delta === 0) return v;
        return {
          ...v,
          departTime: shiftHHMM(v.departTime, delta),
          arriveTime: shiftHHMM(v.arriveTime, delta),
          depotTime: shiftHHMM(v.depotTime, delta),
          stops: v.stops.map((s) => ({ ...s, etaLabel: shiftLabel(s.etaLabel, delta) })),
        };
      });
      return { ...cur, vehicles };
    });
  }

  const isPickup = sug.direction === "PICKUP";
  const fleet = sug.vehicleFleet?.[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-base font-black text-gray-900 dark:text-white">노선 자동 제안</h3>
        <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">
          날짜를 고르면 그 날 등원하는 셔틀 학생만(요일별 스케줄 반영) 등록 차량에 배차합니다. 정차 순서는 드래그(⠿)하거나 ▲▼로 바꾸고, 출발 시각을 직접 조정할 수 있습니다. 각 정차에서 바로 전화·인쇄도 됩니다.
        </p>

        {/* 기준 위치 편집 — 학원·차고지·1호점을 지도로 손쉽게 변경 */}
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
            <select value={date} onChange={(e) => { setDate(e.target.value); generate({ date: e.target.value }); }} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white">
              {sug.availableDates.length === 0 && <option value="">-</option>}
              {sug.availableDates.map((d) => <option key={d.date} value={d.date}>{d.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-gray-500">방향
            <select value={direction} onChange={(e) => { const d = e.target.value as any; setDirection(d); generate({ direction: d }); }} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white">
              <option value="PICKUP">등원 (PICKUP)</option><option value="DROPOFF">하원 (DROPOFF)</option>
            </select>
          </label>
          <button onClick={() => generate()} disabled={loading} className="rounded-xl bg-brand-navy-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-neon-lime dark:text-brand-navy-900">{loading ? "계산 중…" : "⚡ 자동 제안"}</button>
          <button onClick={() => window.print()} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 dark:border-gray-600 dark:text-gray-200">🖨 인쇄</button>
        </div>

        {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">⚠ {err}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-bold text-gray-500">
          <span>{sug.date ?? "-"}{sug.dow ? ` (${sug.dow})` : ""} · {isPickup ? "등원" : "하원"} · {sug.classStart ?? "-"}{sug.classEnd ? `~${sug.classEnd}` : ""} 수업 · 탑승 {sug.totalRiders}명</span>
          {fleet && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-200">🚐 {fleet.name}{fleet.plate ? ` (${fleet.plate})` : ""} · {fleet.capacity}인승</span>}
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${sug.routingProvider === "TMAP" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200" : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>{sug.routingProvider === "TMAP" ? "T맵 최적경로" : "직선 추정"}</span>
        </div>

        {sug.vehicles.length === 0 && <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">이 날짜에 배차할 등원 셔틀 학생이 없습니다.</div>}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {sug.vehicles.map((v, vIdx) => (
            <div key={vIdx} className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between bg-brand-navy-900 px-4 py-2.5 text-white">
                <span className="font-black">🚐 {v.vehicleName}{v.tripLabel ? ` · ${v.tripLabel}` : ""} · {isPickup ? "등원" : "하원"}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${v.over ? "bg-red-500" : "bg-white/15"}`}>{v.passengers} / {v.capacity}명</span>
              </div>
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] font-bold dark:border-gray-700 dark:bg-gray-900/50">
                {v.provider === "TMAP"
                  ? <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">T맵 최적경로</span>
                  : <span className="rounded bg-gray-200 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">직선 추정</span>}
                {v.tmapMinutes != null && <span className="text-gray-500">약 {v.tmapMinutes}분{v.tmapKm != null ? ` · ${v.tmapKm}km` : ""}</span>}
              </div>
              <ol className="divide-y divide-gray-100 dark:divide-gray-700">
                {/* 시작 노드: 등원=차고지 출발 / 하원=학원 출발 */}
                <li className="flex items-center gap-2.5 bg-gray-50/60 px-3 py-2 dark:bg-gray-900/40">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-gray-600 text-[11px] text-white">{isPickup ? "🚏" : "🏫"}</span>
                  <span className="text-[12px] font-bold text-gray-600 dark:text-gray-300">{isPickup ? (sug.depot ? `${sug.depot.name.replace(/^차고지 · /, "차고지 ")} 출발` : "출발") : `${sug.academy.name} 출발`}</span>
                  {/* 출발 시각 직접 조정 — 바꾸면 이 차량 전체 정차 시각이 함께 이동한다. */}
                  <label className="ml-auto flex items-center gap-1 text-[11px] font-bold text-gray-500 print:hidden">
                    출발
                    <input type="time" value={v.departTime ?? ""} onChange={(e) => setDepartTime(vIdx, e.target.value)}
                      className="rounded-lg border border-gray-200 px-1.5 py-0.5 text-[11.5px] font-black text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
                  </label>
                  {v.departTime && <span className="hidden text-[11.5px] font-black text-gray-500 print:inline">{v.departTime} 출발</span>}
                </li>
                {v.stops.map((s, sIdx) => (
                  <li key={sIdx}
                    onDragOver={(e) => {
                      if (drag && drag.v === vIdx) e.preventDefault();       // 정차 순서 변경
                      else if (stuDrag && s.isHub) e.preventDefault();       // 학생을 무료탑승 거점으로
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (drag && drag.v === vIdx && drag.s !== sIdx) reorderStop(vIdx, drag.s, sIdx);
                      else if (stuDrag && s.isHub) moveStudentToHub(stuDrag.v, stuDrag.s, stuDrag.i);
                      setDrag(null); setStuDrag(null);
                    }}
                    className={`flex items-start gap-2 px-3 py-2.5 ${s.isHub ? "bg-green-50/70 dark:bg-green-900/15" : ""} ${drag && drag.v === vIdx && drag.s === sIdx ? "opacity-40" : ""} ${stuDrag && s.isHub ? "ring-2 ring-inset ring-green-400" : ""}`}>
                    {/* 드래그 핸들 — 카드 맨 앞. 이걸 잡고 끌어 정차 순서를 바꾼다. */}
                    <span draggable
                      onDragStart={(e) => { setDrag({ v: vIdx, s: sIdx }); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => setDrag(null)}
                      title="드래그해서 순서 변경"
                      className="mt-0.5 shrink-0 cursor-move select-none text-base leading-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 print:hidden">⠿</span>
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
                            <span className="text-green-700 dark:text-green-300">{isPickup ? "학생을 여기로 끌어다 놓으면 무료탑승으로 지정됩니다 · 워크인 정원 별도" : "여기서 무료로 탑승할 수 있습니다(워크인, 정원 별도)"}</span>
                          </>
                        ) : (
                          s.students.map((st, i) => {
                            const t = tel(st.parentPhone);
                            return <span key={i}
                              draggable={isPickup}
                              onDragStart={isPickup ? (e) => { setStuDrag({ v: vIdx, s: sIdx, i }); e.dataTransfer.effectAllowed = "move"; } : undefined}
                              onDragEnd={() => setStuDrag(null)}
                              title={isPickup ? "드래그해서 무료탑승 거점으로 이동" : undefined}
                              className={isPickup ? "cursor-grab select-none rounded px-0.5 hover:bg-lime-100 dark:hover:bg-lime-900/30" : ""}>
                              {st.name}{st.grade ? `·${st.grade}` : ""}{t && <a href={t} draggable={false} className="ml-0.5 font-bold text-green-600">📞</a>}</span>;
                          })
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 print:hidden">
                      {s.etaLabel && <span className="whitespace-nowrap text-[11.5px] font-black text-blue-600 dark:text-blue-300 print:text-black">{s.etaLabel}</span>}
                      <span className="flex items-center gap-0.5">
                        <button onClick={() => moveStop(vIdx, sIdx, -1)} className="h-6 w-6 rounded border border-gray-200 text-xs dark:border-gray-600">▲</button>
                        <button onClick={() => moveStop(vIdx, sIdx, 1)} className="h-6 w-6 rounded border border-gray-200 text-xs dark:border-gray-600">▼</button>
                      </span>
                    </div>
                    {/* 인쇄본에는 시각만 남기고 조작 버튼은 숨긴다. */}
                    {s.etaLabel && <span className="hidden whitespace-nowrap text-[11.5px] font-black text-black print:inline">{s.etaLabel}</span>}
                  </li>
                ))}
                {/* 종료 노드: 등원=학원 도착 / 하원=차고지 복귀 */}
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

        {sug.unassigned.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="text-[12.5px] font-black text-amber-800 dark:text-amber-200">⚠ 좌표가 없어 배차하지 못한 학생 {sug.unassigned.length}명</div>
            <div className="mt-1 text-[12px] text-amber-700 dark:text-amber-200">{sug.unassigned.map((u) => `${u.name}(${u.label ?? "위치없음"})`).join(", ")}</div>
            <div className="mt-1 text-[11px] text-amber-600">→ 셔틀 명단에서 해당 학생의 위치를 지정하면 자동 배차에 포함됩니다.</div>
          </div>
        )}

        <p className="mt-3 text-[11px] text-gray-400">
          ※ {sug.routingProvider === "TMAP" ? "T맵 실도로 최적경로 기준입니다." : "T맵 연결이 없어 직선거리 근사로 계산했습니다(운영 환경변수 TMAP_APP_KEY 설정 시 실도로 최적경로 사용)."} 정차 순서는 드래그(⠿) 또는 ▲▼로 조정하고, 출발 시각을 바꾸면 그 차량 전체 시각이 함께 이동합니다.
          {sug.depot ? ` · 차고지: ${sug.depot.name.replace(/^차고지 · /, "")}` : ""}
          {sug.hub ? ` · 🆓 ${sug.hub.name} 무료 탑승 거점을 항상 경유합니다` : ""}
        </p>
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
