"use client";

import { useMemo, useState } from "react";
import LocationPickerModal, { type MapLocationData } from "@/components/maps/LocationPickerModal";
import StudentDetailModal from "@/components/seasonal/StudentDetailModal";
import type { ShuttleRosterRow } from "@/lib/seasonal/shuttle-roster";

// 방학특강 셔틀 통합 명단 — 학생 단위 편집 표.
// 컬럼: 학생(클릭 시 상세) · 수업(반·요일) · 승차 위치(핀) · 하차 위치(핀) · 연락(전화/문자 선택).
// 시간 관련 값(학부모 희망시간 등)은 여기서 다루지 않고 노선표에서 확인한다.

function digits(p: string | null): string | null { if (!p) return null; const d = p.replace(/[^0-9]/g, ""); return d.length >= 9 ? d : null; }

async function patchRow(requestId: string, patch: Record<string, unknown>) {
  const r = await fetch("/api/admin/seasonal/shuttle-roster", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, patch }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "저장 실패");
}

// 연락 셀 — 학생/학부모 버튼을 누르면 전화/문자 두 옵션을 띄워 선택 실행.
function ContactCell({ row }: { row: ShuttleRosterRow }) {
  const [open, setOpen] = useState<"parent" | "child" | null>(null);
  const parent = digits(row.parentPhone);
  const child = digits(row.childPhone);
  const btn = "rounded-lg border px-2.5 py-1.5 text-[11px] font-black whitespace-nowrap";
  const act = "rounded-lg px-2.5 py-1.5 text-[11px] font-black text-white";
  const cur = open === "parent" ? parent : open === "child" ? child : null;
  return (
    <div className="relative">
      <div className="flex gap-1.5">
        <button type="button" disabled={!parent} onClick={() => setOpen(open === "parent" ? null : "parent")}
          className={`${btn} ${parent ? "border-blue-200 text-blue-700 dark:border-blue-500/40 dark:text-blue-300" : "border-gray-200 text-gray-300"}`}>📞 학부모</button>
        {child && <button type="button" onClick={() => setOpen(open === "child" ? null : "child")}
          className={`${btn} border-green-200 text-green-700 dark:border-green-500/40 dark:text-green-300`}>📞 학생</button>}
      </div>
      {open && cur && (
        <div className="absolute right-0 z-20 mt-1 flex gap-1.5 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-600 dark:bg-gray-900">
          <a href={`tel:${cur}`} onClick={() => setOpen(null)} className={`${act} bg-green-600`}>전화</a>
          <a href={`sms:${cur}`} onClick={() => setOpen(null)} className={`${act} bg-blue-600`}>문자</a>
          <button onClick={() => setOpen(null)} className="rounded-lg px-2 text-[11px] font-bold text-gray-400">닫기</button>
        </div>
      )}
    </div>
  );
}

export default function ShuttleRosterClient({ initialRoster }: { initialRoster: ShuttleRosterRow[] }) {
  const [rows, setRows] = useState<ShuttleRosterRow[]>(initialRoster);
  const [q, setQ] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinEdit, setPinEdit] = useState<{ requestId: string; kind: "pickup" | "dropoff" } | null>(null);
  const [pinSaving, setPinSaving] = useState(false);
  const [detailAppId, setDetailAppId] = useState<string | null>(null);
  // 미탑승은 기본으로 숨긴다. "역시 태워주세요" 연락이 오면 되돌려야 하므로 지우지 않고 토글로 펼친다.
  const [showNonRiders, setShowNonRiders] = useState(false);

  const searched = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) => [r.childName, r.parentName, r.pickupLocation, r.dropoffLocation, r.offeringTitle].some((v) => (v ?? "").toLowerCase().includes(k)));
  }, [rows, q]);

  const rideCount = rows.filter((r) => r.ride).length;
  const nonRiderCount = rows.length - rideCount;
  const visible = useMemo(() => (showNonRiders ? searched : searched.filter((r) => r.ride)), [searched, showNonRiders]);
  // 기사님께 드리는 파일이다. 미탑승자가 섞이면 실제로 태우면 안 되는 학생을 태우게 된다.
  const exportRows = useMemo(() => searched.filter((r) => r.ride), [searched]);

  function apply(requestId: string, partial: Partial<ShuttleRosterRow>) {
    setRows((cur) => cur.map((r) => (r.requestId === requestId ? { ...r, ...partial } : r)));
  }

  async function save(requestId: string, patch: Record<string, unknown>, optimistic: Partial<ShuttleRosterRow>) {
    apply(requestId, optimistic);
    try { await patchRow(requestId, patch); setSavedAt(Date.now()); setError(null); }
    catch (e: any) { setError(e?.message || "저장 실패"); }
  }

  async function savePin(requestId: string, kind: "pickup" | "dropoff", loc: MapLocationData) {
    setPinSaving(true);
    const addr = loc.roadAddress ?? loc.address;
    const patch = { [`${kind}Pin`]: { latitude: loc.latitude, longitude: loc.longitude, address: loc.address, roadAddress: loc.roadAddress, source: loc.source, placeId: loc.placeId, accuracyMeters: loc.accuracyMeters } };
    const isPinned = loc.source === "MAP_PIN" || loc.source === "CURRENT_LOCATION";
    const optimistic: Partial<ShuttleRosterRow> = kind === "pickup"
      ? { pickupLat: loc.latitude, pickupLng: loc.longitude, pickupPinned: isPinned, pickupApprox: loc.source === "SEARCH" }
      : { dropoffLat: loc.latitude, dropoffLng: loc.longitude, dropoffPinned: isPinned, dropoffApprox: loc.source === "SEARCH" };
    // 표시 라벨(건물명)은 서버에서 유지(비어있을 때만 주소로 채움) — 비어있던 경우 대비해 낙관 반영
    if (kind === "pickup" && !(rows.find((r) => r.requestId === requestId)?.pickupLocation)) optimistic.pickupLocation = addr;
    if (kind === "dropoff" && !(rows.find((r) => r.requestId === requestId)?.dropoffLocation)) optimistic.dropoffLocation = addr;
    try { await save(requestId, patch, optimistic); setPinEdit(null); }
    finally { setPinSaving(false); }
  }

  const pinRow = pinEdit ? rows.find((r) => r.requestId === pinEdit.requestId) : null;

  function exportCsv() {
    const head = ["학생", "학년", "수업", "요일", "승차위치", "하차위치", "학부모전화", "학생전화"];
    const lines = [head.join(",")];
    for (const r of exportRows) {
      const cells = [
        r.childName, r.childGrade ?? "", r.offeringTitle ?? "", r.weekdayLabel ?? "",
        r.pickupLocation ?? "", r.dropoffSameAsPickup ? "등원과 동일" : (r.dropoffLocation ?? ""),
        r.parentPhone ?? "", r.childPhone ?? "",
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `방학특강_셔틀_탑승자명단_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const cell = "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[12.5px] font-semibold hover:border-gray-200 focus:border-[var(--brand-accent)] focus:bg-white focus:outline-none dark:text-white dark:hover:border-gray-600 dark:focus:bg-gray-900";
  const dot = (pinned: boolean, approx: boolean) => `h-2.5 w-2.5 shrink-0 rounded-full ${pinned ? "bg-green-500" : approx ? "bg-amber-400" : "bg-gray-300"}`;
  const pinBtn = (pinned: boolean) => `grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-sm ${pinned ? "border-green-300 text-green-600" : "border-gray-200 text-gray-500 dark:border-gray-600"}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div>
          <h3 className="text-base font-black text-gray-900 dark:text-white">셔틀 통합 명단 <span className="text-xs font-bold text-gray-400">· 학생을 누르면 상세 정보</span></h3>
          <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">승·하차 위치는 지도 핀으로 지정하고, 표시는 아파트·건물명으로 관리합니다. 시간은 노선표에서 확인합니다. (탑승 {rideCount}명)</p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900">
            <span aria-hidden>🔍</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="학생·학부모·아파트 검색" className="w-full bg-transparent text-sm font-semibold outline-none dark:text-white" />
          </div>
          {savedAt && !error && <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11.5px] font-black text-green-700 dark:bg-green-900/30 dark:text-green-300">✓ 저장됨</span>}
          {error && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11.5px] font-black text-red-600">⚠ {error}</span>}
          {nonRiderCount > 0 && (
            <button type="button" onClick={() => setShowNonRiders((v) => !v)}
              className={`rounded-xl border px-3 py-2 text-[13px] font-bold ${showNonRiders ? "border-[var(--brand-accent)] text-[var(--brand-accent)]" : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"}`}>
              {showNonRiders ? <>미탑승 {nonRiderCount}명 숨기기</> : <>미탑승 {nonRiderCount}명 보기</>}
            </button>
          )}
          <button onClick={exportCsv} className="rounded-xl border border-gray-200 px-3 py-2 text-[13px] font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">⬇ 기사님용 내보내기 ({exportRows.length}명)</button>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[820px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <th className="p-2.5">학생</th><th className="p-2.5">수업</th>
                <th className="p-2.5">승차 위치</th><th className="p-2.5">하차 위치</th><th className="p-2.5">연락</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.requestId} className="border-t border-gray-100 align-middle hover:bg-gray-50/50 dark:border-gray-700 dark:hover:bg-gray-900/40">
                  <td className="p-2">
                    <button type="button" onClick={() => setDetailAppId(r.applicationId)} className="group text-left">
                      <div className="font-bold text-gray-900 underline-offset-2 group-hover:text-brand-orange-600 group-hover:underline dark:text-white">
                        {r.childName}{!r.ride && <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] font-black text-gray-500 dark:bg-gray-700">미탑승</span>}
                      </div>
                      <div className="text-[11px] text-gray-400">{[r.childGrade, r.childGender].filter(Boolean).join(" · ")}</div>
                    </button>
                  </td>
                  <td className="p-2 text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">
                    {r.offeringTitle ?? "-"}
                    {r.weekdayLabel && <div className="text-gray-400">{r.weekdayLabel}</div>}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1.5" style={{ minWidth: 190 }}>
                      <input defaultValue={r.pickupLocation ?? ""} key={`p-${r.requestId}-${r.pickupLocation ?? ""}`}
                        onBlur={(e) => { if (e.target.value !== (r.pickupLocation ?? "")) save(r.requestId, { pickupLocation: e.target.value }, { pickupLocation: e.target.value }); }}
                        placeholder={r.ride ? "예: 다산이편한세상자이 정문" : "미탑승"} className={cell} />
                      <button type="button" onClick={() => setPinEdit({ requestId: r.requestId, kind: "pickup" })} title="지도에서 핀 찍기" className={pinBtn(r.pickupPinned)}>📍</button>
                      <span title={r.pickupPinned ? "정밀 핀" : r.pickupApprox ? "자동추정(재확인)" : "미지정"} className={dot(r.pickupPinned, r.pickupApprox)} />
                    </div>
                  </td>
                  <td className="p-2">
                    <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-bold text-gray-600 dark:text-gray-300">
                      <input type="checkbox" checked={r.dropoffSameAsPickup}
                        onChange={(e) => save(r.requestId, { dropoffSameAsPickup: e.target.checked }, { dropoffSameAsPickup: e.target.checked, dropoffLocation: e.target.checked ? r.pickupLocation : r.dropoffLocation })}
                        className="h-4 w-4 accent-[var(--brand-accent)]" />
                      등원과 동일
                    </label>
                    {!r.dropoffSameAsPickup && (
                      <div className="mt-1.5 flex items-center gap-1.5" style={{ minWidth: 190 }}>
                        <input defaultValue={r.dropoffLocation ?? ""} key={`d-${r.requestId}-${r.dropoffLocation ?? ""}`}
                          onBlur={(e) => { if (e.target.value !== (r.dropoffLocation ?? "")) save(r.requestId, { dropoffLocation: e.target.value }, { dropoffLocation: e.target.value }); }}
                          placeholder="예: 힐스테이트다산 정문" className={cell} />
                        <button type="button" onClick={() => setPinEdit({ requestId: r.requestId, kind: "dropoff" })} title="지도에서 핀 찍기" className={pinBtn(r.dropoffPinned)}>📍</button>
                        <span title={r.dropoffPinned ? "정밀 핀" : r.dropoffApprox ? "자동추정(재확인)" : "미지정"} className={dot(r.dropoffPinned, r.dropoffApprox)} />
                      </div>
                    )}
                  </td>
                  <td className="p-2"><ContactCell row={r} /></td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-sm text-gray-400">표시할 셔틀 명단이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">● 초록=정밀 핀 · ● 노랑=자동추정(재확인 권장) · 📍 지도 핀 찍기 · 학생 이름을 누르면 상세 정보가 열립니다.</p>
      </div>

      {pinEdit && pinRow && (
        <LocationPickerModal
          title={`${pinRow.childName} · ${pinEdit.kind === "pickup" ? "등원(승차)" : "하원(하차)"} 위치`}
          initialValue={(() => {
            const lat = pinEdit.kind === "pickup" ? pinRow.pickupLat : pinRow.dropoffLat;
            const lng = pinEdit.kind === "pickup" ? pinRow.pickupLng : pinRow.dropoffLng;
            const addr = pinEdit.kind === "pickup" ? pinRow.pickupLocation : pinRow.dropoffLocation;
            return lat != null && lng != null ? { address: addr ?? "", latitude: lat, longitude: lng, source: "MAP_PIN" as const } : undefined;
          })()}
          confirmPending={pinSaving}
          onConfirm={(loc) => savePin(pinEdit.requestId, pinEdit.kind, loc)}
          onClose={() => setPinEdit(null)}
        />
      )}

      {detailAppId && <StudentDetailModal applicationId={detailAppId} onClose={() => setDetailAppId(null)} />}
    </div>
  );
}
