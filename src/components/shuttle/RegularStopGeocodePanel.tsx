"use client";

import { useMemo, useState } from "react";

// ── 정류장 좌표 채우기 (1회용) ────────────────────────────────
// 좌표(latitude)가 비어 정규 동적배차가 못 도는 정류장들을, 원장이 프로덕션에서
// 한 번 클릭해 카카오 지도로 일괄 지오코딩하고 → 눈으로 확인한 뒤 → 저장하는 화면.
// 상시 기능이 아니라 준비 작업이므로 단순·안전하게(검토 → 확인 → 저장) 만든다.

// 카카오 장소검색(services.Places.keywordSearch) 결과 한 건. x=경도, y=위도.
type KakaoPlace = {
  x: string;
  y: string;
  place_name: string;
  road_address_name?: string;
  address_name?: string;
};
type KakaoSdk = {
  maps: {
    load: (cb: () => void) => void;
    services: { Places: new () => { keywordSearch: (kw: string, cb: (data: KakaoPlace[], status: string) => void) => void } };
  };
};

// 다른 파일에서 window.kakao 타입을 이미 선언하므로, 여기선 캐스팅으로만 접근한다.
function winKakao(): KakaoSdk | undefined {
  return (window as unknown as { kakao?: KakaoSdk }).kakao;
}
let kakaoLoader: Promise<KakaoSdk> | null = null;
// REST 키는 401이라, 브라우저 JS SDK(services 라이브러리)로만 좌표를 찾을 수 있다.
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
    script.onerror = () => { kakaoLoader = null; reject(new Error("카카오 SDK 로드 실패 (도메인 등록 여부 확인)")); };
    document.head.appendChild(script);
  });
  return kakaoLoader;
}

// 키워드 하나로 첫 검색결과를 돌려준다. 못 찾으면 null.
function searchOne(sdk: KakaoSdk, keyword: string): Promise<KakaoPlace | null> {
  return new Promise((resolve) => {
    try {
      new sdk.maps.services.Places().keywordSearch(keyword, (data, status) => {
        if (status === "OK" && data.length > 0) resolve(data[0]);
        else resolve(null);
      });
    } catch { resolve(null); }
  });
}

// 다산 지역 대략 경계. 이 밖의 좌표는 오매칭 가능성이 높아 "확인 필요"로 강조한다.
const DASAN = { latMin: 37.5, latMax: 37.7, lngMin: 127.1, lngMax: 127.2 };
function isOutsideDasan(lat: number, lng: number): boolean {
  return lat < DASAN.latMin || lat > DASAN.latMax || lng < DASAN.lngMin || lng > DASAN.lngMax;
}

// 한 정류장의 지오코딩 결과 상태.
type Row = {
  stopName: string;
  status: "pending" | "found" | "notfound";
  placeName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  outside?: boolean; // 다산 밖(확인 필요)
  include: boolean;  // 저장에 포함할지(관리자 체크)
};

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export default function RegularStopGeocodePanel({ stopNames }: { stopNames: string[] }) {
  const [rows, setRows] = useState<Row[]>(() => stopNames.map((n) => ({ stopName: n, status: "pending", include: false })));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());

  const total = stopNames.length;
  const foundRows = useMemo(() => rows.filter((r) => r.status === "found"), [rows]);
  const notFoundRows = useMemo(() => rows.filter((r) => r.status === "notfound"), [rows]);
  const outsideCount = useMemo(() => foundRows.filter((r) => r.outside).length, [foundRows]);
  const includeCount = useMemo(() => rows.filter((r) => r.status === "found" && r.include && !savedNames.has(r.stopName)).length, [rows, savedNames]);

  // ① 지오코딩 시작 — 각 정류장을 카카오로 순차 검색(지역 힌트 우선 → 폴백).
  async function runGeocode() {
    if (busy || total === 0) return;
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY?.trim();
    if (!key) { setErr("카카오 지도 키(NEXT_PUBLIC_KAKAO_MAP_JS_KEY)가 없습니다."); return; }
    setBusy(true); setErr(null); setMsg(null);
    setProgress({ done: 0, total });
    // 검색 상태 초기화
    setRows(stopNames.map((n) => ({ stopName: n, status: "pending", include: false })));
    try {
      const sdk = await loadKakaoSdk(key);
      const next: Row[] = [];
      for (let i = 0; i < stopNames.length; i++) {
        const name = stopNames[i];
        // 지역 힌트를 붙여 오매칭을 줄이고, 결과 없으면 이름만으로 재시도.
        let place = await searchOne(sdk, `${name} 남양주 다산`);
        if (!place) { await delay(200); place = await searchOne(sdk, name); }
        if (place) {
          const lat = Number(place.y), lng = Number(place.x);
          const ok = Number.isFinite(lat) && Number.isFinite(lng);
          const outside = ok ? isOutsideDasan(lat, lng) : true;
          next.push({
            stopName: name,
            status: ok ? "found" : "notfound",
            placeName: place.place_name,
            address: place.road_address_name || place.address_name || "",
            lat: ok ? lat : undefined,
            lng: ok ? lng : undefined,
            outside,
            include: ok, // 기본 포함(다산 밖도 일단 포함하되 경고로 강조 → 관리자가 해제 가능)
          });
        } else {
          next.push({ stopName: name, status: "notfound", include: false });
        }
        setProgress({ done: i + 1, total });
        // 다음 검색까지 rate limit 대비 간격.
        if (i < stopNames.length - 1) await delay(200);
      }
      setRows(next);
      const foundN = next.filter((r) => r.status === "found").length;
      setMsg(`검색 완료 · ${foundN}/${total}곳 찾음${next.length - foundN > 0 ? ` · ${next.length - foundN}곳 못 찾음` : ""}`);
    } catch (e: unknown) {
      setErr((e as { message?: string })?.message || "지오코딩에 실패했습니다. 카카오 키/도메인 등록을 확인해주세요.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  // 개별 행 포함 여부 토글.
  function toggleInclude(name: string) {
    setRows((prev) => prev.map((r) => (r.stopName === name ? { ...r, include: !r.include } : r)));
  }

  // ② 저장 — '찾음 + 포함 체크 + 아직 저장 안 함' 행만 좌표 저장.
  async function saveCoords() {
    if (saving) return;
    const entries = rows
      .filter((r) => r.status === "found" && r.include && !savedNames.has(r.stopName) && r.lat != null && r.lng != null)
      .map((r) => ({ stopName: r.stopName, latitude: r.lat as number, longitude: r.lng as number }));
    if (entries.length === 0) { setErr("저장할 정류장이 없습니다(체크된 항목 확인)."); return; }
    setSaving(true); setErr(null); setMsg(null);
    try {
      const res = await fetch("/api/admin/shuttle/regular-geocode", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "좌표를 저장하지 못했습니다.");
      // 저장된 이름 표시(재저장 방지 + 완료 배지).
      setSavedNames((prev) => { const n = new Set(prev); for (const e of entries) n.add(e.stopName); return n; });
      setMsg(`${entries.length}곳 좌표 저장 완료. 「정규 배차 다시 열기」로 배차를 확인하세요.`);
    } catch (e: unknown) {
      setErr((e as { message?: string })?.message || "좌표를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (total === 0) {
    return (
      <div className="mx-auto mb-4 max-w-6xl rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] font-bold text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
        ✓ 좌표가 없는 정규 정류장이 없습니다. 모든 정류장에 좌표가 채워져 있습니다.
      </div>
    );
  }

  return (
    <div className="mx-auto mb-4 max-w-6xl px-4">
      <details className="rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20" open>
        <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-black text-amber-800 dark:text-amber-200">
          📍 정류장 좌표 채우기 (1회) · 좌표 없는 정류장 {total}곳
        </summary>
        <div className="border-t border-amber-200 p-4 dark:border-amber-800">
          <p className="text-[12px] text-gray-600 dark:text-gray-300">
            좌표가 없어 동적배차가 못 도는 정류장을 카카오 지도로 한 번에 찾습니다.
            <b> 결과를 눈으로 확인</b>한 뒤(특히 <span className="text-red-600 dark:text-red-300 font-bold">다산 밖(확인 필요)</span> 표시) 저장하세요.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={runGeocode}
              disabled={busy}
              className="rounded-xl bg-brand-navy-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40 dark:bg-white dark:text-brand-navy-900"
            >
              {busy ? "찾는 중…" : "🔍 지오코딩 시작"}
            </button>
            {busy && progress && (
              <span className="text-[12px] font-bold text-gray-600 dark:text-gray-300">{progress.done}/{progress.total} 진행</span>
            )}
            {!busy && foundRows.length > 0 && (
              <button
                onClick={saveCoords}
                disabled={saving || includeCount === 0}
                className="rounded-xl bg-brand-orange-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
              >
                {saving ? "저장 중…" : `💾 선택 저장 (${includeCount})`}
              </button>
            )}
          </div>

          {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-900/30 dark:text-red-200">⚠ {err}</p>}
          {msg && <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-200">✓ {msg}</p>}

          {outsideCount > 0 && !busy && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-900/30 dark:text-red-200">
              ⚠ 다산 밖으로 찾아진 정류장 {outsideCount}곳 — 오매칭일 수 있으니 확인 후 체크를 해제하거나 직접 지정하세요.
            </p>
          )}

          {/* 결과 테이블 — 정류장명 · 찾은 장소/주소 · 좌표 · 상태 */}
          {foundRows.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-black text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                    <th className="px-2 py-2 text-center">저장</th>
                    <th className="px-2 py-2">정류장명</th>
                    <th className="px-2 py-2">찾은 장소 / 주소</th>
                    <th className="px-2 py-2">좌표</th>
                    <th className="px-2 py-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {foundRows.map((r) => {
                    const done = savedNames.has(r.stopName);
                    return (
                      <tr key={r.stopName} className={`border-b border-gray-100 dark:border-gray-700/60 ${r.outside ? "bg-red-50/60 dark:bg-red-900/10" : ""}`}>
                        <td className="px-2 py-2 text-center">
                          {done ? (
                            <span title="저장됨" className="text-green-600 dark:text-green-300">✓</span>
                          ) : (
                            <input type="checkbox" checked={r.include} onChange={() => toggleInclude(r.stopName)} className="h-4 w-4 accent-brand-orange-500" />
                          )}
                        </td>
                        <td className="px-2 py-2 font-bold text-gray-900 dark:text-white">{r.stopName}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-gray-200">
                          <div className="font-semibold">{r.placeName || "-"}</div>
                          {r.address && <div className="text-[11px] text-gray-400">{r.address}</div>}
                        </td>
                        <td className="px-2 py-2 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                          {r.lat?.toFixed(5)}, {r.lng?.toFixed(5)}
                        </td>
                        <td className="px-2 py-2">
                          {done ? (
                            <span className="rounded px-1.5 py-0.5 text-[11px] font-black bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200">저장됨</span>
                          ) : r.outside ? (
                            <span className="rounded px-1.5 py-0.5 text-[11px] font-black bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200">확인 필요</span>
                          ) : (
                            <span className="rounded px-1.5 py-0.5 text-[11px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">찾음</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 못 찾은 정류장 — 직접 지정 필요 */}
          {notFoundRows.length > 0 && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-[12px] font-black text-gray-700 dark:text-gray-200">🔎 못 찾은 정류장 {notFoundRows.length}곳 — 직접 지정 필요</p>
              <p className="mt-0.5 text-[11px] text-gray-400">아래 정류장은 자동으로 찾지 못했습니다. 정규 셔틀 목록(구글시트 정류장) 화면의 지도 피커로 직접 좌표를 지정하세요.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {notFoundRows.map((r) => (
                  <span key={r.stopName} className="rounded-lg bg-gray-100 px-2 py-1 text-[11.5px] font-bold text-gray-600 dark:bg-gray-900 dark:text-gray-300">{r.stopName}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
