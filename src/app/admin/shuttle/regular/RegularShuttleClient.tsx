"use client";

import { useMemo, useState } from "react";
import type { RegularShuttleStop } from "@/lib/shuttle/regularSheet";
import RegularRouteSection, { type ShuttleGeo } from "@/components/shuttle/RegularRouteSection";

// ── 카카오 지도 SDK(장소검색) 로더 ─────────────────────────────
// REST 키는 401이라 브라우저 JS SDK로만 좌표를 찾을 수 있다(방학특강과 동일 방식).
type KakaoPlace = { x: string; y: string; place_name: string; address_name: string };
type KakaoSdk = {
  maps: {
    load: (cb: () => void) => void;
    services: { Places: new () => { keywordSearch: (kw: string, cb: (data: KakaoPlace[], status: string) => void) => void } };
  };
};
// 다른 파일에서 이미 window.kakao 타입을 선언하므로, 여기선 전역 선언 없이 캐스팅으로 접근한다.
function winKakao(): KakaoSdk | undefined { return (window as unknown as { kakao?: KakaoSdk }).kakao; }
let kakaoLoader: Promise<KakaoSdk> | null = null;
function loadKakaoSdk(key: string): Promise<KakaoSdk> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const k = winKakao();
  if (k?.maps?.services) return Promise.resolve(k);
  if (kakaoLoader) return kakaoLoader;
  kakaoLoader = new Promise<KakaoSdk>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-stiz-kakao-map="true"]');
    const onReady = () => {
      const kk = winKakao();
      if (!kk?.maps) { kakaoLoader = null; return reject(new Error("카카오 SDK 로드 실패")); }
      kk.maps.load(() => resolve(kk));
    };
    if (existing) { existing.addEventListener("load", onReady); if (winKakao()?.maps) onReady(); return; }
    const script = document.createElement("script");
    script.dataset.stizKakaoMap = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
    script.onload = onReady;
    script.onerror = () => { kakaoLoader = null; reject(new Error("카카오 SDK 로드 실패")); };
    document.head.appendChild(script);
  });
  return kakaoLoader;
}
// 장소 이름 하나를 좌표로. 첫 검색결과를 쓴다. 못 찾으면 null.
function geocodePlace(sdk: KakaoSdk, keyword: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    try {
      new sdk.maps.services.Places().keywordSearch(keyword, (data, status) => {
        if (status === "OK" && data.length > 0) resolve({ lat: Number(data[0].y), lng: Number(data[0].x) });
        else resolve(null);
      });
    } catch { resolve(null); }
  });
}

// 정규 셔틀 — 구글 시트에서 가져온 요일별 하루 타임라인을 앱에서 본다.
// 각 정차 = 승차/하차/학원경유/복귀. 시트 '가져오기'로 통째 갱신한다.

const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 월→일
const DIR_META: Record<string, { label: string; cls: string }> = {
  BOARD: { label: "승차", cls: "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)]" },
  ALIGHT: { label: "하차", cls: "bg-[var(--doc-grid-head)] text-[var(--doc-warn)]" },
  PIVOT: { label: "학원 경유", cls: "bg-[var(--doc-ink)] text-white" },
  RETURN: { label: "복귀", cls: "bg-[var(--doc-grid-head)] text-[var(--doc-ink-2)]" },
};

function tel(p: string | null): string | null { if (!p) return null; const d = p.replace(/[^0-9]/g, ""); return d.length >= 9 ? `tel:${d}` : null; }
function fmtImported(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("month")}/${g("day")} ${g("hour")}:${g("minute")}`;
}

export default function RegularShuttleClient({ initialStops, importedAt: initialImportedAt, defaultSheetUrl, geo }: {
  initialStops: RegularShuttleStop[];
  importedAt: string | null;
  defaultSheetUrl: string;
  geo: ShuttleGeo;
}) {
  const [stops, setStops] = useState<RegularShuttleStop[]>(initialStops);
  const [importedAt, setImportedAt] = useState<string | null>(initialImportedAt);
  const [sheetUrl, setSheetUrl] = useState(defaultSheetUrl);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoProgress, setGeoProgress] = useState<{ done: number; total: number } | null>(null);

  // 좌표가 아직 없는 '고유 정류장 이름' 목록 — 지오코딩 대상.
  const missingNames = useMemo(() => {
    const names = new Set<string>();
    for (const s of stops) if (s.latitude == null || s.longitude == null) names.add(s.stopName);
    return [...names];
  }, [stops]);
  const totalNames = useMemo(() => new Set(stops.map((s) => s.stopName)).size, [stops]);

  const weekdays = useMemo(() => {
    const present = new Set(stops.map((s) => s.weekday));
    return WD_ORDER.filter((w) => present.has(w)).map((w) => ({ weekday: w, label: `${["일", "월", "화", "수", "목", "금", "토"][w]}요일` }));
  }, [stops]);
  const [active, setActive] = useState<number>(weekdays[0]?.weekday ?? 1);
  const activeWd = weekdays.some((w) => w.weekday === active) ? active : (weekdays[0]?.weekday ?? 1);
  const dayStops = useMemo(() => stops.filter((s) => s.weekday === activeWd).sort((a, b) => a.sortOrder - b.sortOrder), [stops, activeWd]);

  const [mode, setMode] = useState<"dispatch" | "list">("dispatch"); // 배차·지도 / 운행 목록
  // 이 요일의 수업시간 목록(학생이 있는 BOARD/ALIGHT 기준). 배차 단위 = 요일 × 수업 × 방향.
  const classTimes = useMemo(() => {
    const set = new Set<string>();
    for (const s of dayStops) if (s.classTime && s.studentName && (s.direction === "BOARD" || s.direction === "ALIGHT")) set.add(s.classTime);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [dayStops]);
  const [activeClass, setActiveClass] = useState<string>("");
  const curClass = classTimes.includes(activeClass) ? activeClass : (classTimes[0] ?? "");

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

  // 정규 셔틀 기사 고정 링크 복사 — 하나만 전달하면 매일 '오늘 요일' 운행이 자동으로 뜬다.
  async function copyRegularRunLink() {
    setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/admin/shuttle/regular-run-link", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "링크 생성 실패");
      const url = `${window.location.origin}${j.path}`;
      try { await navigator.clipboard.writeText(url); setMsg("기사님 운행 링크를 복사했습니다(매일 열면 오늘 요일 운행)"); }
      catch { setMsg(`기사님 링크: ${url}`); }
    } catch (e: any) { setErr(e?.message || "링크를 만들지 못했습니다."); }
  }

  // 저장 후 목록을 다시 읽어 로컬 상태를 최신화(순서·시각 반영).
  async function refreshStops() {
    const g = await fetch("/api/admin/shuttle/regular", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (g?.stops) { setStops(g.stops); setImportedAt(g.importedAt ?? null); }
  }

  // 좌표 자동 채우기 — 브라우저 카카오 SDK로 정류장 이름을 검색해 좌표를 찾아 DB에 저장한다.
  async function runGeocode() {
    if (geoBusy || missingNames.length === 0) return;
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY?.trim();
    if (!key) { setErr("카카오 지도 키(NEXT_PUBLIC_KAKAO_MAP_JS_KEY)가 없습니다."); return; }
    setGeoBusy(true); setMsg(null); setErr(null);
    setGeoProgress({ done: 0, total: missingNames.length });
    try {
      const sdk = await loadKakaoSdk(key);
      const found: { stopName: string; latitude: number; longitude: number }[] = [];
      const failed: string[] = [];
      for (let i = 0; i < missingNames.length; i++) {
        const name = missingNames[i];
        const c = await geocodePlace(sdk, name);
        if (c) found.push({ stopName: name, latitude: c.lat, longitude: c.lng });
        else failed.push(name);
        setGeoProgress({ done: i + 1, total: missingNames.length });
      }
      if (found.length > 0) {
        const r = await fetch("/api/admin/shuttle/regular-geocode", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: found }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "좌표를 저장하지 못했습니다.");
        // 로컬 상태에도 좌표 반영(새로고침 없이 핀 상태 갱신)
        const coordMap = new Map(found.map((f) => [f.stopName, f]));
        setStops((prev) => prev.map((s) => {
          const c = coordMap.get(s.stopName);
          return c ? { ...s, latitude: c.latitude, longitude: c.longitude } : s;
        }));
      }
      const parts = [`${found.length}곳 좌표 저장`];
      if (failed.length > 0) parts.push(`${failed.length}곳 못 찾음: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? " 외" : ""}`);
      setMsg(parts.join(" · "));
    } catch (e: any) { setErr(e?.message || "좌표 채우기에 실패했습니다."); }
    finally { setGeoBusy(false); setGeoProgress(null); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="rounded-[6px] border border-[var(--doc-rule)] bg-[var(--doc-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[var(--doc-ink)]">정규 셔틀 운행리스트</h3>
            <p className="mt-0.5 text-[12.5px] text-[var(--doc-ink-2)]">구글 시트를 앱으로 가져와 요일별 타임라인으로 봅니다.{importedAt ? ` · 마지막 가져오기 ${fmtImported(importedAt)}` : " · 아직 가져오지 않음"}</p>
          </div>
        </div>

        {/* 시트 가져오기·좌표 채우기 — 최초 1회만 쓰는 준비 작업이라 접어 둔다. */}
        <details className="mt-3 rounded-[3px] border border-[var(--doc-rule)] bg-[var(--doc-grid-head)]" open={stops.length === 0}>
          <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-bold text-[var(--doc-ink-2)]">⚙️ 시트 가져오기 · 좌표 채우기 (최초 1회)</summary>
          <div className="border-t border-[var(--doc-rule)] p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[11px] font-bold text-[var(--doc-ink-2)]">구글 시트 URL
                <input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..." className="rounded-[3px] border border-[var(--doc-rule)] px-3 py-2 text-[12px] font-semibold" />
              </label>
              <button onClick={importSheet} disabled={busy} className="rounded-[3px] bg-[var(--doc-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "가져오는 중…" : "⬇ 시트에서 가져오기"}</button>
            </div>
            {stops.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold text-[var(--doc-ink-2)]">📍 정류장 좌표</p>
                  <p className="text-[11px] text-[var(--doc-ink-2)]">
                    {geoBusy && geoProgress
                      ? `찾는 중… ${geoProgress.done}/${geoProgress.total}`
                      : `${totalNames - missingNames.length}/${totalNames}곳 좌표 있음${missingNames.length > 0 ? ` · ${missingNames.length}곳 남음` : " · 완료"}`}
                  </p>
                </div>
                <button onClick={runGeocode} disabled={geoBusy || missingNames.length === 0}
                  className="rounded-[3px] bg-[var(--doc-ink)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 dark:text-[var(--doc-ink)]">
                  {geoBusy ? "채우는 중…" : missingNames.length === 0 ? "✓ 좌표 완료" : `📍 좌표 자동 채우기 (${missingNames.length})`}
                </button>
              </div>
            )}
          </div>
        </details>
        {err && <p className="mt-2 rounded-[3px] bg-[var(--doc-crit-soft)] px-3 py-2 text-xs font-bold text-[var(--doc-crit)]">⚠ {err}</p>}
        {msg && <p className="mt-2 rounded-[3px] bg-[var(--doc-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--doc-accent)]">✓ {msg}</p>}

        {stops.length === 0 ? (
          <div className="mt-4 rounded-[3px] border border-dashed border-[var(--doc-rule)] p-8 text-center text-sm text-[var(--doc-ink-3)]">아직 가져온 운행리스트가 없습니다. 위에서 「시트에서 가져오기」를 눌러주세요.</div>
        ) : (
          <>
            {/* 요일 탭 */}
            <div className="mt-3 flex flex-wrap items-center gap-1 rounded-[3px] bg-[var(--doc-grid-head)] p-1">
              {weekdays.map((w) => (
                <button key={w.weekday} onClick={() => setActive(w.weekday)}
                  className={`min-h-9 rounded-[3px] px-4 text-sm font-bold ${activeWd === w.weekday ? "bg-[var(--doc-surface)] text-[var(--doc-ink)] " : "text-[var(--doc-ink-2)] hover:text-[var(--doc-ink-2)] dark:hover:text-[var(--doc-ink-3)]"}`}>
                  {w.label}
                </button>
              ))}
            </div>

            {/* 보기 전환: 배차·지도 / 운행 목록 */}
            <div className="mt-3 flex items-center gap-1">
              {([["dispatch", "🗺 배차·지도"], ["list", "📋 운행 목록"]] as const).map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`rounded-[3px] px-3 py-1.5 text-[12px] font-bold ${mode === m ? "bg-[var(--doc-ink)] text-white dark:text-[var(--doc-ink)]" : "text-[var(--doc-ink-2)] hover:text-[var(--doc-ink-2)] dark:hover:text-[var(--doc-ink-3)]"}`}>
                  {label}
                </button>
              ))}
            </div>

            {mode === "dispatch" ? (
              <div className="mt-3">
                {/* 기사님 링크 — 하나만 전달하면 매일 그날 요일 운행이 자동으로 뜬다. */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button onClick={copyRegularRunLink} className="rounded-[3px] bg-[var(--doc-ink)] px-4 py-2.5 text-sm font-bold text-white dark:text-[var(--doc-ink)]">🚌 기사님 운행 링크 복사</button>
                  <span className="text-[11.5px] text-[var(--doc-ink-3)]">기사님 폰·태블릿에 이 링크 하나만 저장 → 매일 열면 그날 요일 노선·탑승체크</span>
                </div>
                {classTimes.length === 0 ? (
                  <div className="rounded-[3px] border border-dashed border-[var(--doc-rule)] p-6 text-center text-sm text-[var(--doc-ink-3)]">이 요일에 수업 정차가 없습니다.</div>
                ) : (
                  <>
                    {/* 수업시간 탭 */}
                    <div className="flex flex-wrap items-center gap-1 rounded-[3px] bg-[var(--doc-grid-head)] p-1">
                      {classTimes.map((ct) => (
                        <button key={ct} onClick={() => setActiveClass(ct)}
                          className={`min-h-8 rounded-[3px] px-3 text-[12.5px] font-bold ${curClass === ct ? "bg-[var(--doc-surface)] text-[var(--doc-ink)] " : "text-[var(--doc-ink-2)] hover:text-[var(--doc-ink-2)] dark:hover:text-[var(--doc-ink-3)]"}`}>
                          {ct}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 space-y-3">
                      <RegularRouteSection dayStops={dayStops} classTime={curClass} direction="BOARD" geo={geo} onSaved={refreshStops} />
                      <RegularRouteSection dayStops={dayStops} classTime={curClass} direction="ALIGHT" geo={geo} onSaved={refreshStops} />
                    </div>
                  </>
                )}
                {/* 안내문 제거 — 뒷문장("기사님 링크·탑승 체크는 다음 단계")이 스테일이다.
                    링크 복사 버튼은 이 화면 위에 이미 있고 탑승 체크도 기사 앱에 구현 완료. */}
              </div>
            ) : (
            <>
            <p className="mt-3 text-[12.5px] font-bold text-[var(--doc-ink-2)]">📅 {["일", "월", "화", "수", "목", "금", "토"][activeWd]}요일 · {dayStops.length}개 정차</p>

            <ol className="mt-2 space-y-1.5">
              {dayStops.map((s, i) => {
                const dir = DIR_META[s.direction] ?? DIR_META.BOARD;
                const isPivot = s.direction === "PIVOT";
                const t = tel(s.studentPhone), tp = tel(s.parentPhone);
                return (
                  <li key={i} className={`rounded-[3px] border p-2.5 ${isPivot ? "border-brand-navy-900/30 bg-[var(--doc-ink)]/5 " : "border-[var(--doc-rule)] "}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-[13px] font-bold text-[var(--doc-ink-2)]">{s.arriveTime ?? "-"}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${dir.cls}`}>{dir.label}</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-[var(--doc-ink)]">{s.stopName}</span>
                      {s.latitude != null && s.longitude != null
                        ? <span title="좌표 있음" className="shrink-0 text-[12px]">📍</span>
                        : <span title="좌표 없음" className="shrink-0 text-[11px] font-bold text-[var(--doc-warn)]">⚠︎</span>}
                      {s.classTime && <span className="shrink-0 text-[11px] font-bold text-[var(--doc-ink-3)]">{s.classTime}</span>}
                    </div>
                    {(s.studentName || t || tp) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-14 text-[12px]">
                        {s.studentName && <span className="font-bold text-[var(--doc-ink-2)]">{s.studentName}</span>}
                        {tp && <a href={tp} className="font-bold text-[var(--doc-ink-2)]">📞 학부모</a>}
                        {t && <a href={t} className="font-bold text-[var(--doc-accent)]">📞 학생</a>}
                        {s.note && <span className="text-[var(--doc-ink-3)]">{s.note}</span>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
