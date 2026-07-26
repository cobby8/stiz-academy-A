"use client";

import { useMemo, useState } from "react";
import type { ShuttleRosterRow } from "@/lib/seasonal/shuttle-roster";

// 방학특강 셔틀 통합 명단 — 기사님 공유 시트를 대체하는 편집형 표.
// 한 줄 = 한 학생. 셀을 수정하면 자동 저장(PATCH)되고, 유사시 학생/학부모에게 바로 전화할 수 있다.

function telHref(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  return digits.length >= 9 ? `tel:${digits}` : null;
}

async function patchRow(requestId: string, patch: Record<string, unknown>) {
  const r = await fetch("/api/admin/seasonal/shuttle-roster", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, patch }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "저장 실패");
}

function CallButtons({ row }: { row: ShuttleRosterRow }) {
  const child = telHref(row.childPhone);
  const parent = telHref(row.parentPhone);
  const base = "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-black whitespace-nowrap";
  return (
    <div className="flex gap-1.5">
      {parent ? (
        <a href={parent} className={`${base} border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300`}>📞 학부모</a>
      ) : <span className={`${base} border-gray-200 text-gray-300`}>학부모 없음</span>}
      {child ? (
        <a href={child} className={`${base} border-green-200 text-green-700 hover:bg-green-50 dark:border-green-500/40 dark:text-green-300`}>📞 학생</a>
      ) : null}
    </div>
  );
}

export default function ShuttleRosterClient({ initialRoster }: { initialRoster: ShuttleRosterRow[] }) {
  const [rows, setRows] = useState<ShuttleRosterRow[]>(initialRoster);
  const [q, setQ] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 미탑승 학생은 기본으로 숨긴다. 완전히 없애지 않는 이유는, "역시 태워주세요" 연락이 왔을 때
  // 이 화면에서 다시 탑승으로 되돌려야 하기 때문이다. 그래서 숨김 + 토글로 처리한다.
  const [showNonRiders, setShowNonRiders] = useState(false);

  // 1단계: 검색어로 거른다.
  const searched = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) =>
      [r.childName, r.parentName, r.pickupLocation, r.dropoffLocation, r.offeringTitle]
        .some((v) => (v ?? "").toLowerCase().includes(k)),
    );
  }, [rows, q]);

  // 2단계: 토글이 꺼져 있으면 미탑승 학생을 화면에서 뺀다.
  const visible = useMemo(
    () => (showNonRiders ? searched : searched.filter((r) => r.ride)),
    [searched, showNonRiders],
  );

  const rideCount = rows.filter((r) => r.ride).length;
  const nonRiderCount = rows.length - rideCount;
  // 기사님에게 넘길 대상 = 지금 검색 조건에 걸린 학생 중 '탑승'인 사람만.
  const exportRows = useMemo(() => searched.filter((r) => r.ride), [searched]);

  function apply(requestId: string, partial: Partial<ShuttleRosterRow>) {
    setRows((cur) => cur.map((r) => (r.requestId === requestId ? { ...r, ...partial } : r)));
  }

  async function save(requestId: string, patch: Record<string, unknown>, optimistic: Partial<ShuttleRosterRow>) {
    apply(requestId, optimistic);
    try {
      await patchRow(requestId, patch);
      setSavedAt(Date.now());
      setError(null);
    } catch (e: any) {
      setError(e?.message || "저장 실패");
    }
  }

  // 기사님용 CSV. 취소자·미탑승자가 절대 들어가면 안 되므로 exportRows(= 탑승자만)를 쓴다.
  // 예전에는 rows(전체)를 그대로 내보내 미탑승자까지 기사님 명단에 실렸다.
  function exportCsv() {
    const head = ["학생", "학년", "수업", "요일", "수업시간", "등원위치", "등원시간", "하원위치", "학부모전화", "학생전화"];
    const lines = [head.join(",")];
    for (const r of exportRows) {
      const cells = [
        r.childName, r.childGrade ?? "", r.offeringTitle ?? "", r.weekdayLabel ?? "",
        r.classStart && r.classEnd ? `${r.classStart}~${r.classEnd}` : (r.classStart ?? ""),
        r.pickupLocation ?? "", r.pickupTime ?? "",
        r.dropoffSameAsPickup ? "등원과 동일" : (r.dropoffLocation ?? ""),
        r.parentPhone ?? "", r.childPhone ?? "",
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    // 파일명에 '탑승자'를 박아 둔다. 기사님이 파일만 보고도 전체 명단이 아님을 알 수 있어야 한다.
    a.href = url; a.download = `방학특강_셔틀_탑승자명단_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const cell = "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[12.5px] font-semibold hover:border-gray-200 focus:border-[var(--brand-accent)] focus:bg-white focus:outline-none dark:text-white dark:hover:border-gray-600 dark:focus:bg-gray-900";

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">셔틀 통합 명단 <span className="text-xs font-bold text-gray-400">· 셀을 눌러 바로 수정</span></h3>
            <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">한 줄에 학생의 수업·등원·하원·연락을 모아 관리합니다. 변경은 자동 저장됩니다. (탑승 {rideCount}명{nonRiderCount > 0 ? ` · 미탑승 ${nonRiderCount}명` : ""})</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900">
            <span aria-hidden>🔍</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="학생·학부모·아파트 검색" className="w-full bg-transparent text-sm font-semibold outline-none dark:text-white" />
          </div>
          {/* 미탑승 학생 보기 토글 — 기본은 꺼짐(숨김). 켜면 회색 처리된 행으로 다시 나타난다. */}
          <label className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-bold whitespace-nowrap ${nonRiderCount === 0 ? "border-gray-200 text-gray-300 dark:border-gray-700 dark:text-gray-600" : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900"}`}>
            <input
              type="checkbox"
              checked={showNonRiders}
              disabled={nonRiderCount === 0}
              onChange={(e) => setShowNonRiders(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand-accent)]"
            />
            미탑승 {nonRiderCount}명 보기
          </label>
          {savedAt && !error && <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11.5px] font-black text-green-700 dark:bg-green-900/30 dark:text-green-300">✓ 저장됨</span>}
          {error && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11.5px] font-black text-red-600">⚠ {error}</span>}
          <button onClick={exportCsv} disabled={exportRows.length === 0} className="rounded-xl border border-gray-200 px-3 py-2 text-[13px] font-bold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 dark:border-gray-600 dark:text-gray-200 dark:disabled:text-gray-600">⬇ 기사님용 내보내기 (탑승 {exportRows.length}명)</button>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[920px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <th className="p-2.5">학생</th><th className="p-2.5">수업 · 시간</th><th className="p-2.5">탑승</th>
                <th className="p-2.5">등원 위치</th><th className="p-2.5">등원시간</th><th className="p-2.5">하원 위치</th><th className="p-2.5">연락</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                // 미탑승 행은 회색 배경 + 흐리게 처리해 정상 탑승자와 확실히 구분한다(오탑승 방지).
                <tr
                  key={r.requestId}
                  className={`border-t border-gray-100 align-middle dark:border-gray-700 ${r.ride ? "hover:bg-gray-50/50 dark:hover:bg-gray-900/40" : "bg-gray-100/70 opacity-60 dark:bg-gray-900/60"}`}
                >
                  <td className="p-2">
                    <div className="font-bold text-gray-900 dark:text-white">
                      {r.childName}
                      {!r.ride && <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-black text-gray-600 dark:bg-gray-700 dark:text-gray-300">미탑승</span>}
                    </div>
                    <div className="text-[11px] text-gray-400">{[r.childGrade, r.childGender].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="p-2 text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">
                    {r.offeringTitle ?? "-"}
                    <div className="text-gray-400">{[r.weekdayLabel, r.classStart && r.classEnd ? `${r.classStart}~${r.classEnd}` : r.classStart].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => save(r.requestId, { ride: !r.ride }, { ride: !r.ride })}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-black ${r.ride ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300"}`}
                    >{r.ride ? "탑승" : "미탑승"}</button>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1.5" style={{ minWidth: 160 }}>
                      <input
                        defaultValue={r.pickupLocation ?? ""}
                        onBlur={(e) => { if (e.target.value !== (r.pickupLocation ?? "")) save(r.requestId, { pickupLocation: e.target.value }, { pickupLocation: e.target.value }); }}
                        placeholder={r.ride ? "정차 위치" : "미탑승"}
                        className={cell}
                      />
                      <span title={r.pickupPinned ? "정밀 핀" : r.pickupApprox ? "자동추정(재확인)" : "미지정"}
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.pickupPinned ? "bg-green-500" : r.pickupApprox ? "bg-amber-400" : "bg-gray-300"}`} />
                    </div>
                  </td>
                  <td className="p-2">
                    <input
                      defaultValue={r.pickupTime ?? ""}
                      onBlur={(e) => { if (e.target.value !== (r.pickupTime ?? "")) save(r.requestId, { pickupTime: e.target.value }, { pickupTime: e.target.value }); }}
                      placeholder="시간"
                      className={`${cell} w-20`}
                    />
                  </td>
                  <td className="p-2">
                    <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-bold text-gray-600 dark:text-gray-300">
                      <input type="checkbox" checked={r.dropoffSameAsPickup}
                        onChange={(e) => save(r.requestId, { dropoffSameAsPickup: e.target.checked }, { dropoffSameAsPickup: e.target.checked, dropoffLocation: e.target.checked ? r.pickupLocation : r.dropoffLocation })}
                        className="h-4 w-4 accent-[var(--brand-accent)]" />
                      등원과 동일
                    </label>
                    {!r.dropoffSameAsPickup && (
                      <div className="mt-1.5 flex items-center gap-1.5" style={{ minWidth: 160 }}>
                        <input
                          defaultValue={r.dropoffLocation ?? ""}
                          onBlur={(e) => { if (e.target.value !== (r.dropoffLocation ?? "")) save(r.requestId, { dropoffLocation: e.target.value }, { dropoffLocation: e.target.value }); }}
                          placeholder="하원 위치"
                          className={cell}
                        />
                        <span title={r.dropoffPinned ? "정밀 핀" : r.dropoffApprox ? "자동추정(재확인)" : "미지정"}
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.dropoffPinned ? "bg-green-500" : r.dropoffApprox ? "bg-amber-400" : "bg-gray-300"}`} />
                      </div>
                    )}
                  </td>
                  <td className="p-2"><CallButtons row={r} /></td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-sm text-gray-400">
                  {!showNonRiders && searched.length > 0
                    ? "탑승 학생이 없습니다. '미탑승 보기'를 켜면 미탑승 학생을 확인할 수 있습니다."
                    : "표시할 셔틀 명단이 없습니다."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">● 초록=정밀 핀 · ● 노랑=자동추정(재확인 권장) · 📞 버튼은 실제 전화로 연결됩니다.</p>
        <p className="mt-1 text-[11px] text-gray-400">신청을 취소했거나 개설이 취소된 반의 학생은 이 명단에 나오지 않습니다. 내보내기 파일에는 탑승 학생만 담깁니다.</p>
      </div>
    </div>
  );
}
