"use client";

import { useState, type FormEvent } from "react";
import {
  DocPage, DocSheet, DocHead, DocLabel, DocSummary, DocButton,
  DocBadge, DocInput, DocNotice, DocEmpty, DocRow, DocModal,
} from "@/components/doc";

// 셔틀 차량 관리 — 자동 배차가 쓰는 차량(ShuttleVehicle)을 등록·수정·활성/비활성한다.
// (옛 '노선 만들기'는 자동 배차 화면으로 대체되어, 이 화면은 차량 관리만 담당한다.)
//
// 2026-08 학적부 스타일 적용 — **화면 그리는 부분만** 바꿨다.
// 상태·fetch·save·toggleActive 로직은 한 줄도 손대지 않았다.

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
    <DocPage>
      <DocSheet>
        <DocHead
          title="차량 관리"
          sub="여기 등록한 활성 차량을 자동 배차가 정원에 맞춰 사용합니다."
          right={<DocButton kind="primary" onClick={() => setModal("new")}>차량 등록</DocButton>}
        />

        <div className="mt-4">
          <DocSummary items={[
            { label: "활성 차량", value: `${active.length}대` },
            { label: "전체", value: `${vehicles.length}대` },
          ]} />
        </div>

        {(err || notice) && (
          <div className="mt-4 space-y-2">
            {err && <DocNotice tone="error">{err}</DocNotice>}
            {notice && <DocNotice tone="ok">{notice}</DocNotice>}
          </div>
        )}

        <div className="mt-6">
          <DocLabel>등록 차량</DocLabel>
          {vehicles.length === 0 ? (
            <DocEmpty title="등록된 차량이 없습니다" hint="「차량 등록」으로 추가하면 자동 배차가 이 차량을 사용합니다" />
          ) : (
            <div style={{ borderTop: "1.5px solid var(--doc-ink)" }}>
              {vehicles.map((v) => {
                const on = v.isActive !== false;
                return (
                  <DocRow key={v.id} muted={!on} accent={on ? "var(--doc-accent)" : undefined}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-bold" style={{ color: "var(--doc-ink)" }}>{v.name}</span>
                        {v.plateNumber && (
                          <span className="font-mono text-[12px] tabular-nums" style={{ color: "var(--doc-ink-2)" }}>
                            {v.plateNumber}
                          </span>
                        )}
                        <DocBadge tone="mute">{v.capacity}인승</DocBadge>
                        {!on && <DocBadge tone="mute">비활성</DocBadge>}
                      </div>
                      {v.notes && (
                        <p className="m-0 mt-1 text-[12px]" style={{ color: "var(--doc-ink-3)" }}>{v.notes}</p>
                      )}
                    </div>
                    <DocButton onClick={() => setModal(v)} disabled={pending}>수정</DocButton>
                    <DocButton
                      kind={on ? "quiet" : "primary"}
                      onClick={() => toggleActive(v)}
                      disabled={pending}
                    >
                      {on ? "비활성화" : "활성화"}
                    </DocButton>
                  </DocRow>
                );
              })}
            </div>
          )}
        </div>
      </DocSheet>

      {modal && (
        <DocModal title={editing ? "차량 수정" : "차량 등록"} onClose={() => setModal(null)}>
          <form onSubmit={save} className="space-y-3">
            <DocInput label="차량명" name="name" required autoFocus
                      defaultValue={editing?.name ?? ""} placeholder="예: 스타리아 1호차" />
            <DocInput label="차량번호" name="plateNumber"
                      defaultValue={editing?.plateNumber ?? ""} placeholder="예: 12가 3456" />
            <DocInput label="승차 정원" name="capacity" type="number" min="1" required
                      defaultValue={editing?.capacity ?? ""} placeholder="예: 15" />
            <DocInput label="메모" name="notes" defaultValue={editing?.notes ?? ""} />
            <div className="flex gap-2 pt-2">
              <DocButton type="button" onClick={() => setModal(null)} disabled={pending}>취소</DocButton>
              <DocButton type="submit" kind="primary" disabled={pending} className="flex-1">
                {pending ? "저장 중…" : editing ? "수정" : "등록"}
              </DocButton>
            </div>
          </form>
        </DocModal>
      )}
    </DocPage>
  );
}
