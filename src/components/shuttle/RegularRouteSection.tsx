"use client";

import { useMemo } from "react";
import { RouteMapCanvas } from "@/components/seasonal/DispatchRouteMap";
import type { RegularShuttleStop } from "@/lib/shuttle/regularSheet";

// 정규 셔틀 배차 — 한 방향(등원=BOARD / 하원=ALIGHT)의 노선 목록 + 지도.
// 방학특강 배차와 같은 모양이되, 정규는 노선이 이미 시트에 정해져 있으므로 '보기' 중심이다(순서변경·저장은 다음 단계).

export type Geo = { lat: number; lng: number; name: string };
export type ShuttleGeo = { academy: Geo; depot: Geo | null; hub: Geo | null };

function tel(p: string | null): string | null { if (!p) return null; const d = p.replace(/[^0-9]/g, ""); return d.length >= 9 ? `tel:${d}` : null; }

// 같은 정류장(이름 기준)끼리 학생을 묶어 정차 하나로 만든다. 첫 도착시각·좌표를 대표로 쓴다.
type GroupedStop = {
  label: string;
  arriveTime: string | null;
  lat: number | null;
  lng: number | null;
  students: { name: string; studentPhone: string | null; parentPhone: string | null }[];
};
function groupStops(rows: RegularShuttleStop[]): GroupedStop[] {
  const order: string[] = [];
  const map = new Map<string, GroupedStop>();
  for (const r of rows) {
    const key = r.stopName;
    let g = map.get(key);
    if (!g) {
      g = { label: r.stopName, arriveTime: r.arriveTime, lat: r.latitude ?? null, lng: r.longitude ?? null, students: [] };
      map.set(key, g); order.push(key);
    }
    if (g.lat == null && r.latitude != null) { g.lat = r.latitude; g.lng = r.longitude ?? null; }
    if (!g.arriveTime && r.arriveTime) g.arriveTime = r.arriveTime;
    if (r.studentName) g.students.push({ name: r.studentName, studentPhone: r.studentPhone, parentPhone: r.parentPhone });
  }
  return order.map((k) => map.get(k)!);
}

export default function RegularRouteSection({ dayStops, classTime, direction, geo }: {
  dayStops: RegularShuttleStop[];
  classTime: string;
  direction: "BOARD" | "ALIGHT";
  geo: ShuttleGeo;
}) {
  const isPickup = direction === "BOARD";
  const grouped = useMemo(() => {
    const rows = dayStops
      .filter((s) => s.classTime === classTime && s.direction === direction && s.studentName)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return groupStops(rows);
  }, [dayStops, classTime, direction]);

  const startPt = isPickup ? (geo.depot ?? geo.academy) : geo.academy;
  const endPt = isPickup ? geo.academy : (geo.depot ?? geo.academy);
  const withCoord = grouped.filter((g) => g.lat != null && g.lng != null);
  const totalStudents = grouped.reduce((a, g) => a + g.students.length, 0);
  const missingCoord = grouped.length - withCoord.length;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-2 dark:border-gray-700">
        <span className={`grid h-8 w-8 place-items-center rounded-xl text-lg ${isPickup ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200"}`}>{isPickup ? "⬆" : "⬇"}</span>
        <div>
          <p className="text-[15px] font-black text-gray-900 dark:text-white">{classTime} · {isPickup ? "등원" : "하원"}</p>
          <p className="text-[11.5px] font-bold text-gray-500">{grouped.length}개 정차 · {totalStudents}명{missingCoord > 0 ? ` · ⚠︎ 좌표없음 ${missingCoord}` : ""}</p>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">이 수업 {isPickup ? "등원" : "하원"} 정차가 없습니다.</div>
      ) : (
        <div className="mt-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
          {/* 목록 */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
            <ol className="divide-y divide-gray-100 dark:divide-gray-700">
              <li className="flex items-center gap-2.5 bg-gray-50/60 px-3 py-2 dark:bg-gray-900/40">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gray-600 text-[11px] text-white">{isPickup ? "🚏" : "🏫"}</span>
                <span className="text-[12px] font-bold text-gray-600 dark:text-gray-300">{startPt.name} 출발</span>
              </li>
              {grouped.map((g, i) => (
                <li key={i} className="flex items-start gap-2 px-3 py-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-orange-500 text-[11px] font-black text-white">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-bold text-gray-900 dark:text-white">{g.label}</span>
                      <span className="shrink-0 rounded bg-lime-200 px-1.5 text-[10px] font-black text-brand-navy-900">{g.students.length}명</span>
                      {g.lat == null && <span title="좌표 없음" className="shrink-0 text-[11px] font-black text-amber-500">⚠︎</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11.5px] text-gray-500">
                      {g.students.map((st, k) => { const t = tel(st.parentPhone); return <span key={k} className="font-bold text-gray-700 dark:text-gray-200">{st.name}{t && <a href={t} className="ml-0.5 text-green-600">📞</a>}</span>; })}
                    </div>
                  </div>
                  {g.arriveTime && <span className="shrink-0 text-[11.5px] font-black text-blue-600 dark:text-blue-300">{g.arriveTime}</span>}
                </li>
              ))}
              <li className="flex items-center gap-2.5 bg-gray-50 px-3 py-2.5 dark:bg-gray-900">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-navy-900 text-[11px] text-white">{isPickup ? "🏫" : "🚏"}</span>
                <span className="text-[12.5px] font-bold text-gray-700 dark:text-gray-200">{endPt.name} {isPickup ? "도착" : "복귀"}</span>
              </li>
            </ol>
          </div>

          {/* 지도 */}
          <aside className="mt-3 lg:mt-0 lg:sticky lg:top-4">
            <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="bg-brand-navy-900 px-3 py-2 text-xs font-black text-white">🗺 {isPickup ? "등원" : "하원"} 경로{missingCoord > 0 ? " (좌표 있는 정차만)" : ""}</div>
              <RouteMapCanvas
                start={{ lat: startPt.lat, lng: startPt.lng, label: isPickup ? "차고지" : "학원" }}
                end={{ lat: endPt.lat, lng: endPt.lng, label: isPickup ? "학원" : "차고지" }}
                stops={withCoord.map((g, i) => ({ lat: g.lat!, lng: g.lng!, label: g.label, badge: String(i + 1), kind: "stop" as const }))}
                heightClass="h-[42vh] lg:h-[48vh]"
              />
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
