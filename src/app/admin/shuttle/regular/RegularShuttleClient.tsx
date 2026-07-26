"use client";

import { useMemo, useState } from "react";
import type { RegularShuttleStop } from "@/lib/shuttle/regularSheet";

// 정규 셔틀 — 구글 시트에서 가져온 요일별 하루 타임라인을 앱에서 본다.
// 각 정차 = 승차/하차/학원경유/복귀. 시트 '가져오기'로 통째 갱신한다.

const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 월→일
const DIR_META: Record<string, { label: string; cls: string }> = {
  BOARD: { label: "승차", cls: "bg-blue-100 text-blue-700" },
  ALIGHT: { label: "하차", cls: "bg-orange-100 text-orange-700" },
  PIVOT: { label: "학원 경유", cls: "bg-brand-navy-900 text-white" },
  RETURN: { label: "복귀", cls: "bg-gray-200 text-gray-600" },
};

function tel(p: string | null): string | null { if (!p) return null; const d = p.replace(/[^0-9]/g, ""); return d.length >= 9 ? `tel:${d}` : null; }
function fmtImported(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("month")}/${g("day")} ${g("hour")}:${g("minute")}`;
}

export default function RegularShuttleClient({ initialStops, importedAt: initialImportedAt, defaultSheetUrl }: {
  initialStops: RegularShuttleStop[];
  importedAt: string | null;
  defaultSheetUrl: string;
}) {
  const [stops, setStops] = useState<RegularShuttleStop[]>(initialStops);
  const [importedAt, setImportedAt] = useState<string | null>(initialImportedAt);
  const [sheetUrl, setSheetUrl] = useState(defaultSheetUrl);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const weekdays = useMemo(() => {
    const present = new Set(stops.map((s) => s.weekday));
    return WD_ORDER.filter((w) => present.has(w)).map((w) => ({ weekday: w, label: `${["일", "월", "화", "수", "목", "금", "토"][w]}요일` }));
  }, [stops]);
  const [active, setActive] = useState<number>(weekdays[0]?.weekday ?? 1);
  const activeWd = weekdays.some((w) => w.weekday === active) ? active : (weekdays[0]?.weekday ?? 1);
  const dayStops = useMemo(() => stops.filter((s) => s.weekday === activeWd).sort((a, b) => a.sortOrder - b.sortOrder), [stops, activeWd]);

  async function importSheet() {
    if (busy) return;
    setBusy(true); setMsg(null); setErr(null);
    try {
      const r = await fetch("/api/admin/shuttle/regular-import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sheetUrl }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "가져오지 못했습니다.");
      setMsg(`가져왔습니다 · ${j.imported}개 정차${j.title ? ` (${j.title})` : ""}`);
      // 새로고침 없이 다시 읽어 반영
      const g = await fetch("/api/admin/shuttle/regular", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (g?.stops) { setStops(g.stops); setImportedAt(g.importedAt ?? null); }
    } catch (e: any) { setErr(e?.message || "가져오지 못했습니다."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">정규 셔틀 운행리스트</h3>
            <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">구글 시트를 앱으로 가져와 요일별 타임라인으로 봅니다.{importedAt ? ` · 마지막 가져오기 ${fmtImported(importedAt)}` : " · 아직 가져오지 않음"}</p>
          </div>
        </div>

        {/* 시트 가져오기 */}
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[11px] font-bold text-gray-500">구글 시트 URL
            <input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..." className="rounded-lg border border-gray-200 px-3 py-2 text-[12px] font-semibold dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          </label>
          <button onClick={importSheet} disabled={busy} className="rounded-xl bg-brand-orange-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{busy ? "가져오는 중…" : "⬇ 시트에서 가져오기"}</button>
        </div>
        {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">⚠ {err}</p>}
        {msg && <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-200">✓ {msg}</p>}

        {stops.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">아직 가져온 운행리스트가 없습니다. 위에서 「시트에서 가져오기」를 눌러주세요.</div>
        ) : (
          <>
            {/* 요일 탭 */}
            <div className="mt-3 flex flex-wrap items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900">
              {weekdays.map((w) => (
                <button key={w.weekday} onClick={() => setActive(w.weekday)}
                  className={`min-h-9 rounded-lg px-4 text-sm font-black ${activeWd === w.weekday ? "bg-white text-brand-navy-900 shadow dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
                  {w.label}
                </button>
              ))}
            </div>

            <p className="mt-3 text-[12.5px] font-black text-gray-700 dark:text-gray-200">📅 {["일", "월", "화", "수", "목", "금", "토"][activeWd]}요일 · {dayStops.length}개 정차</p>

            <ol className="mt-2 space-y-1.5">
              {dayStops.map((s, i) => {
                const dir = DIR_META[s.direction] ?? DIR_META.BOARD;
                const isPivot = s.direction === "PIVOT";
                const t = tel(s.studentPhone), tp = tel(s.parentPhone);
                return (
                  <li key={i} className={`rounded-xl border p-2.5 ${isPivot ? "border-brand-navy-900/30 bg-brand-navy-900/5 dark:border-white/20 dark:bg-white/5" : "border-gray-200 dark:border-gray-700"}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-[13px] font-black text-blue-600 dark:text-blue-300">{s.arriveTime ?? "-"}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-black ${dir.cls}`}>{dir.label}</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-gray-900 dark:text-white">{s.stopName}</span>
                      {s.classTime && <span className="shrink-0 text-[11px] font-bold text-gray-400">{s.classTime}</span>}
                    </div>
                    {(s.studentName || t || tp) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-14 text-[12px]">
                        {s.studentName && <span className="font-bold text-gray-700 dark:text-gray-200">{s.studentName}</span>}
                        {tp && <a href={tp} className="font-bold text-blue-600 dark:text-blue-300">📞 학부모</a>}
                        {t && <a href={t} className="font-bold text-green-600 dark:text-green-300">📞 학생</a>}
                        {s.note && <span className="text-gray-400">{s.note}</span>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
        <p className="mt-3 text-[11px] text-gray-400">※ 지금은 시트를 그대로 가져와 보여줍니다. 좌표(핀)·지도·기사님 링크·탑승 체크는 다음 단계에서 붙입니다.</p>
      </div>
    </div>
  );
}
