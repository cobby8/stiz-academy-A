"use client";

import { useState } from "react";

// 기사님 운행 화면(모바일) — 그 날 등원 → 하원 타임라인. 각 구간에서 정차 순서대로 학생을 보고 탑승/미탑승을 탭으로 체크한다.
// 로그인 없이 토큰으로 접근하며, 체크는 즉시 서버에 저장한다(구간=방향별).

export type DriverStudent = { requestId: string; name: string; grade: string | null; parentPhone: string | null; childPhone: string | null };
export type DriverStop = { label: string; isHub: boolean; etaLabel: string | null; students: DriverStudent[] };
export type DriverVehicle = { vehicleName: string; tripLabel: string | null; departTime: string | null; arriveTime: string | null; depotTime: string | null; stops: DriverStop[] };
export type DriverSection = { direction: "PICKUP" | "DROPOFF"; time: string | null; startName: string; endName: string; vehicles: DriverVehicle[] };
type Status = "BOARDED" | "NOSHOW";
type BoardingByDir = { PICKUP: Record<string, Status>; DROPOFF: Record<string, Status> };

function digits(p: string | null): string | null { if (!p) return null; const d = p.replace(/[^0-9]/g, ""); return d.length >= 9 ? d : null; }
function fmtDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(`${iso}T00:00:00+09:00`).getDay()] ?? "";
  return `${Number(m[2])}/${Number(m[3])}${dow ? ` (${dow})` : ""}`;
}

export default function DriverRunClient({
  token, date, sections, initialBoarding,
}: {
  token: string;
  date: string;
  sections: DriverSection[];
  initialBoarding: BoardingByDir;
}) {
  const [boarding, setBoarding] = useState<BoardingByDir>(initialBoarding);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function toggle(direction: "PICKUP" | "DROPOFF", reqId: string, name: string, next: Status) {
    const key = `${direction}:${reqId}`;
    if (busy[key]) return;
    const cur = boarding[direction][reqId] ?? null;
    const target: Status | null = cur === next ? null : next;
    setBoarding((b) => {
      const dirMap = { ...b[direction] };
      if (target) dirMap[reqId] = target; else delete dirMap[reqId];
      return { ...b, [direction]: dirMap };
    });
    setBusy((x) => ({ ...x, [key]: true }));
    try {
      const r = await fetch("/api/shuttle/boarding", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, direction, shuttleRequestId: reqId, status: target, studentName: name }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setBoarding((b) => {
        const dirMap = { ...b[direction] };
        if (cur) dirMap[reqId] = cur; else delete dirMap[reqId];
        return { ...b, [direction]: dirMap };
      });
    } finally {
      setBusy((x) => ({ ...x, [key]: false }));
    }
  }

  return (
    <div className="mx-auto max-w-md px-3 pb-24">
      <header className="sticky top-0 z-10 -mx-3 mb-2 border-b border-gray-200 bg-white/95 px-3 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
        <p className="text-[15px] font-black text-gray-900 dark:text-white">🚌 스티즈 셔틀 운행</p>
        <p className="text-xs font-bold text-gray-500">{fmtDate(date)} · 등원 → 하원</p>
      </header>

      {sections.map((sec) => {
        const isPickup = sec.direction === "PICKUP";
        const map = boarding[sec.direction];
        const all = sec.vehicles.flatMap((v) => v.stops.flatMap((s) => s.students));
        const boarded = all.filter((s) => map[s.requestId] === "BOARDED").length;
        const noshow = all.filter((s) => map[s.requestId] === "NOSHOW").length;
        let seq = 0;
        return (
          <section key={sec.direction} className="mb-4">
            {/* 구간 헤더: 시간 · 방향 */}
            <div className={`sticky top-[52px] z-[5] -mx-1 mb-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${isPickup ? "bg-blue-600" : "bg-orange-600"} text-white`}>
              <span className="text-[15px] font-black">{isPickup ? "⬆" : "⬇"} {sec.time ?? "-"} · {isPickup ? "등원" : "하원"}</span>
              <span className="text-[13px] font-black">{boarded}/{all.length} 탑승{noshow > 0 ? ` · 미탑승 ${noshow}` : ""}</span>
            </div>

            {sec.vehicles.length === 0 && <p className="rounded-xl bg-gray-50 px-3 py-3 text-center text-[13px] font-bold text-gray-400 dark:bg-gray-800">이 구간에 배차된 학생이 없습니다.</p>}

            {sec.vehicles.map((v, vi) => (
              <div key={vi} className="mb-2">
                {sec.vehicles.length > 1 && <p className="mb-1 text-[12px] font-black text-gray-500">🚐 {v.vehicleName}{v.tripLabel ? ` · ${v.tripLabel}` : ""}</p>}
                <div className="mb-1 flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-[12px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <span>{isPickup ? "🚏" : "🏫"}</span>{sec.startName} 출발{v.departTime ? ` · ${v.departTime}` : ""}
                </div>
                <ol className="space-y-1.5">
                  {v.stops.map((s, si) => {
                    if (!s.isHub) seq += 1;
                    return (
                      <li key={si} className={`rounded-xl border p-2.5 ${s.isHub ? "border-green-200 bg-green-50/70 dark:border-green-500/30 dark:bg-green-900/15" : "border-gray-200 dark:border-gray-700"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black text-white ${s.isHub ? "bg-green-600" : "bg-brand-orange-500"}`}>{s.isHub ? "🆓" : seq}</span>
                          <span className="min-w-0 flex-1 truncate text-[14px] font-black text-gray-900 dark:text-white">{s.label}</span>
                          {s.etaLabel && <span className="shrink-0 text-[12px] font-black text-blue-600 dark:text-blue-300">{s.etaLabel}</span>}
                        </div>
                        {s.isHub && s.students.length === 0 && <p className="mt-1 text-[12px] font-semibold text-green-700 dark:text-green-300">무료 거점(워크인, 정원 별도)</p>}
                        <div className="mt-1.5 space-y-1.5">
                          {s.students.map((st) => {
                            const status = map[st.requestId] ?? null;
                            const parent = digits(st.parentPhone), child = digits(st.childPhone);
                            return (
                              <div key={st.requestId} className="flex items-center gap-2 rounded-lg bg-gray-50 p-1.5 dark:bg-gray-800/60">
                                <div className="min-w-0 flex-1">
                                  <span className="text-[14px] font-bold text-gray-900 dark:text-white">{st.name}</span>
                                  {st.grade && <span className="ml-1 text-[12px] text-gray-400">{st.grade}</span>}
                                  <div className="mt-0.5 flex gap-2">
                                    {parent && <a href={`tel:${parent}`} className="text-[12px] font-bold text-blue-600 dark:text-blue-300">📞 학부모</a>}
                                    {child && <a href={`tel:${child}`} className="text-[12px] font-bold text-green-600 dark:text-green-300">📞 학생</a>}
                                  </div>
                                </div>
                                <button type="button" disabled={busy[`${sec.direction}:${st.requestId}`]} onClick={() => toggle(sec.direction, st.requestId, st.name, "BOARDED")}
                                  className={`h-10 min-w-[52px] rounded-lg text-[13px] font-black ${status === "BOARDED" ? "bg-green-600 text-white" : "border border-green-300 text-green-700 dark:border-green-500/40 dark:text-green-300"}`}>{isPickup ? "탑승" : "하차"}</button>
                                <button type="button" disabled={busy[`${sec.direction}:${st.requestId}`]} onClick={() => toggle(sec.direction, st.requestId, st.name, "NOSHOW")}
                                  className={`h-10 min-w-[52px] rounded-lg text-[13px] font-black ${status === "NOSHOW" ? "bg-red-500 text-white" : "border border-red-300 text-red-600 dark:border-red-500/40 dark:text-red-300"}`}>미{isPickup ? "탑승" : "하차"}</button>
                              </div>
                            );
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-1 flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-[12px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <span>{isPickup ? "🏫" : "🚏"}</span>{sec.endName} {isPickup ? "도착" : "복귀"}{(isPickup ? v.arriveTime : v.depotTime) ? ` · ${isPickup ? v.arriveTime : v.depotTime}` : ""}
                </div>
              </div>
            ))}
          </section>
        );
      })}
      <p className="mt-2 text-center text-[11px] text-gray-400">탭 한 번으로 저장됩니다 · 다시 누르면 대기로 돌아갑니다</p>
    </div>
  );
}
