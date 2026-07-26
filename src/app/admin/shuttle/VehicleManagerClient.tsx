"use client";

import { useState, type FormEvent } from "react";

// 셔틀 차량 관리 — 자동 배차가 쓰는 차량(ShuttleVehicle)을 등록·수정·활성/비활성한다.
// (옛 '노선 만들기'는 자동 배차 화면으로 대체되어, 이 화면은 차량 관리만 담당한다.)

type Vehicle = { id: string; name: string; plateNumber?: string | null; capacity: number; notes?: string | null; isActive?: boolean };

const API = "/api/admin/shuttle";

export default function VehicleManagerClient({ initialVehicles }: { initialVehicles: Vehicle[] }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles ?? []);
  const [modal, setModal] = useState<"new" | Vehicle | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  async function reload() {
    try {
      const r = await fetch(`${API}?direction=PICKUP`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(j.vehicles)) setVehicles(j.vehicles);
    } catch { /* 유지 */ }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editing = modal && modal !== "new" ? modal : null;
    const v = Object.fromEntries(new FormData(event.currentTarget));
    const data = { name: v.name, plateNumber: v.plateNumber || undefined, capacity: Number(v.capacity), notes: v.notes || undefined };
    setPending(true); setErr(""); setNotice("");
    try {
      const r = await fetch(API, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { resource: "vehicle", id: editing.id, data } : { resource: "vehicle", data }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "저장하지 못했습니다.");
      setNotice(editing ? "차량 정보를 수정했습니다." : "차량을 등록했습니다.");
      setModal(null);
      await reload();
    } catch (e: any) { setErr(e?.message || "저장하지 못했습니다."); }
    finally { setPending(false); }
  }

  async function toggleActive(vehicle: Vehicle) {
    setPending(true); setErr(""); setNotice("");
    try {
      const r = await fetch(API, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "vehicle", id: vehicle.id, data: { isActive: !(vehicle.isActive !== false) } }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "변경하지 못했습니다.");
      setNotice(vehicle.isActive !== false ? "차량을 비활성화했습니다." : "차량을 활성화했습니다.");
      await reload();
    } catch (e: any) { setErr(e?.message || "변경하지 못했습니다."); }
    finally { setPending(false); }
  }

  const editing = modal && modal !== "new" ? modal : null;
  const active = vehicles.filter((v) => v.isActive !== false);

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">차량 관리</h3>
            <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">여기 등록한 활성 차량을 <b>자동 배차</b>가 정원에 맞춰 사용합니다. 노선 편성·기사 배정은 「자동 배차」 탭에서 합니다.</p>
          </div>
          <button onClick={() => setModal("new")} className="rounded-xl bg-brand-orange-500 px-4 py-2.5 text-sm font-black text-white">＋ 차량 등록</button>
        </div>

        {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">⚠ {err}</p>}
        {notice && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-200">✓ {notice}</p>}

        <p className="mt-3 text-[12px] font-bold text-gray-500">활성 차량 {active.length}대 · 전체 {vehicles.length}대</p>

        <div className="mt-2 space-y-2">
          {vehicles.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">등록된 차량이 없습니다. 「차량 등록」으로 추가하세요.</div>}
          {vehicles.map((v) => {
            const on = v.isActive !== false;
            return (
              <div key={v.id} className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${on ? "border-gray-200 dark:border-gray-700" : "border-gray-200 bg-gray-50 opacity-70 dark:border-gray-700 dark:bg-gray-900/40"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-black text-gray-900 dark:text-white">🚐 {v.name}</span>
                    {v.plateNumber && <span className="text-[12px] font-bold text-gray-500">{v.plateNumber}</span>}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-black text-gray-600 dark:bg-gray-700 dark:text-gray-200">{v.capacity}인승</span>
                    {!on && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-black text-gray-500 dark:bg-gray-700">비활성</span>}
                  </div>
                  {v.notes && <p className="mt-0.5 text-[12px] text-gray-400">{v.notes}</p>}
                </div>
                <button onClick={() => setModal(v)} disabled={pending} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] font-bold text-gray-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200">수정</button>
                <button onClick={() => toggleActive(v)} disabled={pending} className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-bold disabled:opacity-50 ${on ? "border-gray-200 text-gray-500 dark:border-gray-600" : "border-green-300 text-green-700 dark:border-green-500/40 dark:text-green-300"}`}>{on ? "비활성화" : "활성화"}</button>
              </div>
            );
          })}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-3xl">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">{editing ? "차량 수정" : "차량 등록"}</h2>
            <form onSubmit={save} className="mt-4 space-y-3">
              <label className="block text-sm font-bold text-gray-600 dark:text-gray-300">차량명
                <input name="name" required autoFocus defaultValue={editing?.name ?? ""} placeholder="예: 스타리아 1호차" className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
              </label>
              <label className="block text-sm font-bold text-gray-600 dark:text-gray-300">차량번호
                <input name="plateNumber" defaultValue={editing?.plateNumber ?? ""} placeholder="예: 12가 3456" className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
              </label>
              <label className="block text-sm font-bold text-gray-600 dark:text-gray-300">승차 정원
                <input name="capacity" type="number" min="1" required defaultValue={editing?.capacity ?? ""} placeholder="예: 15" className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
              </label>
              <label className="block text-sm font-bold text-gray-600 dark:text-gray-300">메모
                <input name="notes" defaultValue={editing?.notes ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setModal(null)} disabled={pending} className="min-h-11 rounded-xl border border-gray-300 px-5 font-bold text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200">취소</button>
                <button type="submit" disabled={pending} className="min-h-11 flex-1 rounded-xl bg-brand-orange-500 px-5 font-black text-white disabled:opacity-50">{pending ? "저장 중…" : editing ? "수정" : "등록"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
