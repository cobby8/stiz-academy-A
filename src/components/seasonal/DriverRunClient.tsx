"use client";

import { useMemo, useState } from "react";

// 기사님 운행 화면(모바일) — 정차 순서대로 학생을 보고, 탑승/미탑승을 탭으로 체크한다.
// 로그인 없이 토큰으로 접근하며, 체크는 즉시 서버에 저장한다.

export type DriverStudent = { requestId: string; name: string; grade: string | null; parentPhone: string | null; childPhone: string | null };
export type DriverStop = { label: string; isHub: boolean; etaLabel: string | null; students: DriverStudent[] };
export type DriverVehicle = { vehicleName: string; tripLabel: string | null; departTime: string | null; arriveTime: string | null; depotTime: string | null; stops: DriverStop[] };
type Status = "BOARDED" | "NOSHOW";

function digits(p: string | null): string | null { if (!p) return null; const d = p.replace(/[^0-9]/g, ""); return d.length >= 9 ? d : null; }
function fmtDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(`${iso}T00:00:00+09:00`).getDay()] ?? "";
  return `${Number(m[2])}/${Number(m[3])}${dow ? ` (${dow})` : ""}`;
}

export default function DriverRunClient({
  token, date, direction, startName, endName, vehicles, initialBoarding,
}: {
  token: string;
  date: string;
  direction: "PICKUP" | "DROPOFF";
  startName: string;
  endName: string;
  vehicles: DriverVehicle[];
  initialBoarding: Record<string, Status>;
}) {
  const isPickup = direction === "PICKUP";
  const [active, setActive] = useState(0);
  const [boarding, setBoarding] = useState<Record<string, Status>>(initialBoarding);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const v = vehicles[active];
  const stats = useMemo(() => {
    const all = (v?.stops ?? []).flatMap((s) => s.students);
    const boarded = all.filter((s) => boarding[s.requestId] === "BOARDED").length;
    const noshow = all.filter((s) => boarding[s.requestId] === "NOSHOW").length;
    return { total: all.length, boarded, noshow };
  }, [v, boarding]);

  async function toggle(reqId: string, name: string, next: Status) {
    if (busy[reqId]) return;
    const target: Status | null = boarding[reqId] === next ? null : next; // 같은 걸 다시 누르면 대기로
    const prev = boarding[reqId] ?? null;
    setBoarding((b) => { const n = { ...b }; if (target) n[reqId] = target; else delete n[reqId]; return n; });
    setBusy((x) => ({ ...x, [reqId]: true }));
    try {
      const r = await fetch("/api/shuttle/boarding", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, shuttleRequestId: reqId, status: target, studentName: name }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setBoarding((b) => { const n = { ...b }; if (prev) n[reqId] = prev; else delete n[reqId]; return n; }); // 실패 롤백
    } finally {
      setBusy((x) => ({ ...x, [reqId]: false }));
    }
  }

  if (!v) {
    return <div className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-6 text-center text-sm font-bold text-gray-500">이 날짜에 운행할 노선이 없습니다.</div>;
  }

  let seq = 0;
  return (
    <div className="mx-auto max-w-md px-3 pb-24">
      {/* 상단 고정: 차량·방향·날짜 + 진행률 */}
      <header className="sticky top-0 z-10 -mx-3 mb-2 border-b border-gray-200 bg-white/95 px-3 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[15px] font-black text-gray-900 dark:text-white">🚌 {v.vehicleName}{v.tripLabel ? ` · ${v.tripLabel}` : ""}</p>
            <p className="text-xs font-bold text-gray-500">{fmtDate(date)} · {isPickup ? "등원" : "하원"}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-brand-orange-600 dark:text-brand-neon-lime">{stats.boarded}/{stats.total}</p>
            <p className="text-[11px] font-bold text-gray-500">탑승{stats.noshow > 0 ? ` · 미탑승 ${stats.noshow}` : ""}</p>
          </div>
        </div>
        {vehicles.length > 1 && (
          <select value={active} onChange={(e) => setActive(Number(e.target.value))} className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white">
            {vehicles.map((veh, i) => <option key={i} value={i}>{veh.vehicleName}{veh.tripLabel ? ` · ${veh.tripLabel}` : ""}</option>)}
          </select>
        )}
      </header>

      {/* 출발 */}
      <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-[13px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        <span>{isPickup ? "🚏" : "🏫"}</span>{startName} 출발{v.departTime ? ` · ${v.departTime}` : ""}
      </div>

      <ol className="mt-2 space-y-2">
        {v.stops.map((s, sIdx) => {
          if (!s.isHub) seq += 1;
          return (
            <li key={sIdx} className={`rounded-xl border p-3 ${s.isHub ? "border-green-200 bg-green-50/70 dark:border-green-500/30 dark:bg-green-900/15" : "border-gray-200 dark:border-gray-700"}`}>
              <div className="flex items-center gap-2">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black text-white ${s.isHub ? "bg-green-600" : "bg-brand-orange-500"}`}>{s.isHub ? "🆓" : seq}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-black text-gray-900 dark:text-white">{s.label}</span>
                {s.etaLabel && <span className="shrink-0 text-[12px] font-black text-blue-600 dark:text-blue-300">{s.etaLabel}</span>}
              </div>
              {s.isHub && s.students.length === 0 && <p className="mt-1 text-[12px] font-semibold text-green-700 dark:text-green-300">무료 탑승 거점(워크인, 정원 별도)</p>}
              <div className="mt-2 space-y-1.5">
                {s.students.map((st) => {
                  const status = boarding[st.requestId] ?? null;
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
                      <button type="button" disabled={busy[st.requestId]} onClick={() => toggle(st.requestId, st.name, "BOARDED")}
                        className={`h-10 min-w-[54px] rounded-lg text-[13px] font-black ${status === "BOARDED" ? "bg-green-600 text-white" : "border border-green-300 text-green-700 dark:border-green-500/40 dark:text-green-300"}`}>탑승</button>
                      <button type="button" disabled={busy[st.requestId]} onClick={() => toggle(st.requestId, st.name, "NOSHOW")}
                        className={`h-10 min-w-[54px] rounded-lg text-[13px] font-black ${status === "NOSHOW" ? "bg-red-500 text-white" : "border border-red-300 text-red-600 dark:border-red-500/40 dark:text-red-300"}`}>미탑승</button>
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      {/* 도착 */}
      <div className="mt-2 flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-[13px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        <span>{isPickup ? "🏫" : "🚏"}</span>{endName} {isPickup ? "도착" : "복귀"}{(isPickup ? v.arriveTime : v.depotTime) ? ` · ${isPickup ? v.arriveTime : v.depotTime}` : ""}
      </div>

      <p className="mt-4 text-center text-[11px] text-gray-400">탭 한 번으로 저장됩니다 · 다시 누르면 대기로 돌아갑니다</p>
    </div>
  );
}
