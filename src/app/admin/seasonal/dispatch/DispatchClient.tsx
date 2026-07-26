"use client";

import { useState } from "react";
import type { DispatchSuggestion } from "@/lib/seasonal/shuttle-optimize";

// 방학특강 셔틀 노선 자동 제안 화면.
// 날짜(요일 반복 스케줄)와 방향을 고르면 그 날 등원하는 셔틀 학생만 등록 차량 정원에 맞춰 배차한다.

function tel(p: string | null): string | null { if (!p) return null; const d = p.replace(/[^0-9]/g, ""); return d.length >= 9 ? `tel:${d}` : null; }

export default function DispatchClient({ initial }: { initial: DispatchSuggestion }) {
  const [sug, setSug] = useState<DispatchSuggestion>(initial);
  const [direction, setDirection] = useState<"PICKUP" | "DROPOFF">(initial.direction);
  const [date, setDate] = useState<string>(initial.date ?? "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    } catch (e: any) { setErr(e?.message || "실패"); }
    finally { setLoading(false); }
  }

  function moveStop(vIdx: number, sIdx: number, dir: -1 | 1) {
    setSug((cur) => {
      const vehicles = cur.vehicles.map((v) => ({ ...v, stops: [...v.stops] }));
      const stops = vehicles[vIdx].stops; const j = sIdx + dir;
      if (j < 0 || j >= stops.length) return cur;
      [stops[sIdx], stops[j]] = [stops[j], stops[sIdx]];
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
          날짜를 고르면 그 날 등원하는 셔틀 학생만(요일별 스케줄 반영) 등록 차량에 배차합니다. 정차 순서는 위/아래로 조정하고, 각 정차에서 바로 전화·인쇄할 수 있습니다.
        </p>

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
                  {isPickup && v.depotTime && <span className="ml-auto text-[11.5px] font-black text-gray-500">{v.depotTime} 출발</span>}
                </li>
                {v.stops.map((s, sIdx) => (
                  <li key={sIdx} className="flex items-start gap-2.5 px-3 py-2.5">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-orange-500 text-[11px] font-black text-white">{sIdx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-gray-900 dark:text-white">
                        {s.label}
                        <span className="ml-1 rounded bg-lime-200 px-1.5 text-[10px] font-black text-brand-navy-900">{s.students.length}명</span>
                        {s.approx && <span className="ml-1 rounded bg-amber-100 px-1.5 text-[10px] font-black text-amber-700">추정</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11.5px] text-gray-500">
                        {s.students.map((st, i) => { const t = tel(st.parentPhone); return <span key={i}>{st.name}{st.grade ? `·${st.grade}` : ""}{t && <a href={t} className="ml-0.5 font-bold text-green-600">📞</a>}</span>; })}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {s.etaLabel && <span className="whitespace-nowrap text-[11.5px] font-black text-blue-600 dark:text-blue-300">{s.etaLabel}</span>}
                      <span className="flex gap-0.5">
                        <button onClick={() => moveStop(vIdx, sIdx, -1)} className="h-6 w-6 rounded border border-gray-200 text-xs dark:border-gray-600">▲</button>
                        <button onClick={() => moveStop(vIdx, sIdx, 1)} className="h-6 w-6 rounded border border-gray-200 text-xs dark:border-gray-600">▼</button>
                      </span>
                    </div>
                  </li>
                ))}
                {/* 종료 노드: 등원=학원 도착 / 하원=차고지 복귀 */}
                <li className="flex items-center gap-2.5 bg-gray-50 px-3 py-2.5 dark:bg-gray-900">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-navy-900 text-[11px] text-white">{isPickup ? "🏫" : "🚏"}</span>
                  <span className="text-[12.5px] font-bold text-gray-700 dark:text-gray-200">{isPickup ? `${sug.academy.name} 도착` : (sug.depot ? `${sug.depot.name.replace(/^차고지 · /, "차고지 ")} 복귀` : "복귀")}</span>
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
          ※ {sug.routingProvider === "TMAP" ? "T맵 실도로 최적경로 기준입니다." : "T맵 연결이 없어 직선거리 근사로 계산했습니다(운영 환경변수 TMAP_APP_KEY 설정 시 실도로 최적경로 사용)."} 정차 순서는 위/아래로 조정 가능합니다.
          {sug.depot ? ` · 차고지: ${sug.depot.name.replace(/^차고지 · /, "")}` : ""}
        </p>
      </div>
    </div>
  );
}
