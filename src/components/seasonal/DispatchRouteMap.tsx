"use client";

import { useEffect, useId, useRef, useState } from "react";
import { loadKakaoMaps, type KakaoSdk, type KakaoMapObj, type KakaoOverlay } from "@/lib/kakao/loadKakaoMaps";

// 배차 노선을 지도로 보여준다 — T맵 실도로 경로(path)가 있으면 그 선을, 없으면 정차를 직선으로 잇는다.
// 정차마다 번호(또는 무료/출발/도착) 마커를 찍어 최적경로를 눈으로 판별하게 한다.

export type RouteMapStop = { lat: number; lng: number; label: string; badge: string; kind: "stop" | "hub" };
type Endpoint = { lat: number; lng: number; label: string } | null;

export default function DispatchRouteMap({
  title, start, end, stops, path, onClose,
}: {
  title: string;
  start: Endpoint;
  end: Endpoint;
  stops: RouteMapStop[];
  path?: { lat: number; lng: number }[];
  onClose: () => void;
}) {
  const titleId = useId();
  const mapElRef = useRef<HTMLDivElement>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY?.trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  useEffect(() => {
    if (!apiKey || !mapElRef.current) { setStatus("fallback"); return; }
    let cancelled = false;
    loadKakaoMaps(apiKey).then((sdk: KakaoSdk) => {
      if (cancelled || !mapElRef.current) return;
      const maps = sdk.maps;
      const nodes = [
        ...(start ? [{ ...start, badge: "출발", kind: "start" as const }] : []),
        ...stops.map((s) => ({ ...s })),
        ...(end ? [{ ...end, badge: "도착", kind: "end" as const }] : []),
      ];
      if (nodes.length === 0) { setStatus("fallback"); return; }
      const center = new maps.LatLng(nodes[0].lat, nodes[0].lng);
      const map = new maps.Map(mapElRef.current, { center, level: 5 });

      // 경로 선: 실도로 경로가 있으면 그걸, 없으면 정차 순서대로 직선.
      const lineCoords = (path && path.length ? path : nodes.map((n) => ({ lat: n.lat, lng: n.lng })))
        .map((c) => new maps.LatLng(c.lat, c.lng));
      const polyline = new maps.Polyline({
        path: lineCoords, strokeWeight: 5, strokeColor: "#2563eb", strokeOpacity: 0.85,
        strokeStyle: path && path.length ? "solid" : "shortdash", map,
      });
      overlaysRef.current.push(polyline);

      // 정차 마커(번호/무료/출발/도착) — CustomOverlay로 색 있는 원형 배지.
      const bounds = new maps.LatLngBounds();
      for (const n of nodes) {
        const pos = new maps.LatLng(n.lat, n.lng);
        bounds.extend(pos);
        const color = n.kind === "hub" ? "#16a34a" : n.kind === "start" || n.kind === "end" ? "#1e293b" : "#f97316";
        const el = document.createElement("div");
        el.style.cssText = `transform:translateY(-50%);display:flex;align-items:center;gap:4px;`;
        el.innerHTML =
          `<span style="display:grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:${color};color:#fff;font-size:11px;font-weight:800;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)">${escapeHtml(n.badge)}</span>` +
          `<span style="max-width:150px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:1px 5px;font-size:11px;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 2px rgba(0,0,0,.15)">${escapeHtml(n.label)}</span>`;
        const overlay = new maps.CustomOverlay({ position: pos, content: el, yAnchor: 0.5, xAnchor: 0, zIndex: 5 });
        overlay.setMap(map);
        overlaysRef.current.push(overlay);
      }
      map.setBounds(bounds, 40, 40, 40, 40);
      setStatus("ready");
      window.setTimeout(() => map.relayout(), 0);
    }).catch(() => { if (!cancelled) setStatus("fallback"); });
    return () => {
      cancelled = true;
      overlaysRef.current.forEach((o) => { try { o.setMap(null); } catch { /* noop */ } });
      overlaysRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <section className="flex max-h-[96dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-800 sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div>
            <p className="text-xs font-bold text-brand-orange-500 dark:text-brand-neon-lime">노선 지도</p>
            <h2 id={titleId} className="text-base font-black text-gray-900 dark:text-white">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="지도 닫기" className="flex size-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">✕</button>
        </header>
        <div className="relative h-[70dvh] min-h-80 w-full bg-gray-100 dark:bg-gray-900">
          <div ref={mapElRef} className="absolute inset-0" aria-label="노선 지도" />
          {status === "loading" && <div className="absolute inset-0 grid place-items-center text-sm font-bold text-gray-500">지도를 불러오는 중…</div>}
          {status === "fallback" && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm font-bold text-gray-500">
              지도를 표시할 수 없습니다. 카카오 지도 키(NEXT_PUBLIC_KAKAO_MAP_JS_KEY)를 확인해주세요.
            </div>
          )}
        </div>
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-200 px-4 py-2 text-[11.5px] font-bold text-gray-500 dark:border-gray-700">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "#1e293b" }} />출발·도착</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "#f97316" }} />정차 순서</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "#16a34a" }} />무료 탑승 거점</span>
          <span className="ml-auto">{path && path.length ? "파란 선 = T맵 실도로 경로" : "파란 점선 = 정차 순서(직선)"}</span>
        </footer>
      </section>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
