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
  if (!sharing) return <span className="h-3 w-3 rounded-full bg-gray-400 shrink-0" title="공유 중단" />;
  if (secondsAgo < 30) return <span className="h-3 w-3 rounded-full bg-green-500 shrink-0 animate-pulse" title="실시간" />;
  if (secondsAgo < 120) return <span className="h-3 w-3 rounded-full bg-yellow-500 shrink-0" title="지연" />;
  return <span className="h-3 w-3 rounded-full bg-red-400 shrink-0" title="끊김" />;
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
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-[17px] font-black text-gray-900 dark:text-white">
              🚌 실시간 차량 위치
            </h2>
            {lastRefresh && (
              <p className="text-[12px] text-gray-400 mt-0.5">
                30초마다 자동 갱신 · 마지막: {lastRefresh.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-[22px] text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {/* 본문 */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {loading && (
            <p className="py-8 text-center text-sm text-gray-400">불러오는 중…</p>
          )}
          {!loading && locations.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-[15px] font-bold text-gray-500">현재 위치를 공유 중인 기사님이 없습니다</p>
              <p className="mt-1 text-[13px] text-gray-400">기사님 화면에서 위치 공유를 켜면 여기에 표시됩니다</p>
            </div>
          )}
          {locations.map((loc) => (
            <div
              key={loc.token}
              className={`rounded-xl border-2 p-4 ${
                !loc.sharing ? "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50" :
                loc.secondsAgo < 120 ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/20" :
                "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <StatusDot sharing={loc.sharing} secondsAgo={loc.secondsAgo} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-black text-gray-900 dark:text-white">
                    {loc.label ?? "기사님"}
                  </p>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400">
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
                    className="shrink-0 rounded-lg bg-yellow-400 px-3 py-2 text-[13px] font-black text-gray-900 hover:bg-yellow-300"
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
          <div className="border-t border-gray-200 px-5 py-3 text-[13px] text-gray-500 dark:border-gray-700">
            활성 {activeCount}대 · 전체 {locations.length}대 (최근 10분 기준)
          </div>
        )}
      </div>
    </div>
  );
}
