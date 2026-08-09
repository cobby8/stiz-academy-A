"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DriverLocationRow } from "@/app/api/admin/driver-locations/route";

// 관리자 — 실시간 차량 위치 패널. 30초마다 자동 갱신.

function elapsedLabel(sec: number): string {
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  return `${Math.floor(sec / 3600)}시간 전`;
}

function kakaoMapUrl(label: string | null, lat: number, lng: number): string {
  const name = encodeURIComponent(label ?? "차량 위치");
  return `https://map.kakao.com/link/map/${name},${lat},${lng}`;
}

function StatusDot({ sharing, secondsAgo }: { sharing: boolean; secondsAgo: number }) {
  if (!sharing) return <span className="h-3 w-3 rounded-[3px] bg-[var(--doc-grid-head)] shrink-0" title="공유 중단" />;
  if (secondsAgo < 30) return <span className="h-3 w-3 rounded-[3px] bg-[var(--doc-accent)] shrink-0" title="실시간" />;
  if (secondsAgo < 120) return <span className="h-3 w-3 rounded-[3px] bg-[var(--doc-grid-head)] shrink-0" title="지연" />;
  return <span className="h-3 w-3 rounded-[3px] bg-red-400 shrink-0" title="끊김" />;
}

export default function DriverLocationPanel({ onClose }: { onClose: () => void }) {
  const [locations, setLocations] = useState<DriverLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/driver-locations");
      if (!res.ok) return;
      const data = await res.json() as { locations: DriverLocationRow[] };
      setLocations(data.locations);
      setLastRefresh(new Date());
    } catch {
      // 일시 오류 무시
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => void load(), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const activeCount = locations.filter((l) => l.sharing && l.secondsAgo < 120).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[6px] bg-[var(--doc-surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-[var(--doc-rule)] px-5 py-4">
          <div>
            <h2 className="text-[17px] font-bold text-[var(--doc-ink)]">
              🚌 실시간 차량 위치
            </h2>
            {lastRefresh && (
              <p className="text-[12px] text-[var(--doc-ink-3)] mt-0.5">
                30초마다 자동 갱신 · 마지막: {lastRefresh.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-[22px] text-[var(--doc-ink-3)] hover:text-[var(--doc-ink-2)]">✕</button>
        </div>

        {/* 본문 */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {loading && (
            <p className="py-8 text-center text-sm text-[var(--doc-ink-3)]">불러오는 중…</p>
          )}
          {!loading && locations.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-[15px] font-bold text-[var(--doc-ink-2)]">현재 위치를 공유 중인 기사님이 없습니다</p>
              <p className="mt-1 text-[13px] text-[var(--doc-ink-3)]">기사님 화면에서 위치 공유를 켜면 여기에 표시됩니다</p>
            </div>
          )}
          {locations.map((loc) => (
            <div
              key={loc.token}
              className={`rounded-[3px] border-2 p-4 ${
 !loc.sharing ? "border-[var(--doc-rule)] bg-[var(--doc-grid-head)] " :
 loc.secondsAgo < 120 ? "border-[var(--doc-accent)] bg-[var(--doc-accent-soft)] " :
 "border-[var(--doc-warn)] bg-[var(--doc-grid-head)] "
 }`}
            >
              <div className="flex items-start gap-3">
                <StatusDot sharing={loc.sharing} secondsAgo={loc.secondsAgo} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-[var(--doc-ink)]">
                    {loc.label ?? "기사님"}
                  </p>
                  <p className="text-[13px] text-[var(--doc-ink-2)]">
                    {loc.sharing
                      ? `${elapsedLabel(loc.secondsAgo)} 업데이트${loc.accuracy != null ? ` · 정확도 ${Math.round(loc.accuracy)}m` : ""}`
                      : "위치 공유 중단"}
                  </p>
                </div>
                {loc.sharing && (
                  <a
                    href={kakaoMapUrl(loc.label, loc.latitude, loc.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-[3px] bg-[var(--doc-grid-head)] px-3 py-2 text-[13px] font-bold text-[var(--doc-ink)] hover:bg-[var(--doc-grid-head)]"
                  >
                    지도↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 하단 요약 */}
        {!loading && locations.length > 0 && (
          <div className="border-t border-[var(--doc-rule)] px-5 py-3 text-[13px] text-[var(--doc-ink-2)]">
            활성 {activeCount}대 · 전체 {locations.length}대 (최근 10분 기준)
          </div>
        )}
      </div>
    </div>
  );
}
