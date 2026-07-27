"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GpsState = "off" | "requesting" | "active" | "denied" | "error";

export function useGpsShare(token: string, label?: string) {
  const [state, setState] = useState<GpsState>("off");
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const posRef = useRef<GeolocationPosition | null>(null);
  const tokenRef = useRef(token);
  const labelRef = useRef(label);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { labelRef.current = label; }, [label]);

  const send = useCallback(async (pos: GeolocationPosition, sharing = true) => {
    const { latitude: lat, longitude: lng, accuracy: acc, speed, heading } = pos.coords;
    try {
      await fetch("/api/driver/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenRef.current,
          label: labelRef.current,
          lat, lng,
          accuracy: acc ?? undefined,
          speed: speed ?? undefined,
          heading: heading ?? undefined,
          sharing,
        }),
      });
      if (sharing) {
        setLastSentAt(new Date());
        setAccuracy(acc ?? null);
      }
    } catch {
      // 네트워크 일시 오류 — 다음 인터벌에서 재시도
    }
  }, []);

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) { setState("error"); return; }
    setState("requesting");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        posRef.current = pos;
        setState("active");
      },
      (err) => {
        setState(err.code === 1 /* PERMISSION_DENIED */ ? "denied" : "error");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    // 첫 전송은 위치가 들어오는 즉시(watchPosition 콜백), 이후 10초마다
    intervalRef.current = setInterval(() => {
      if (posRef.current) void send(posRef.current);
    }, 10_000);
  }, [send]);

  const stop = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // 공유 중단 신호 1회 전송 (관리자 화면에서 "공유 중단" 상태로 표시)
    if (posRef.current) await send(posRef.current, false);
    posRef.current = null;
    setState("off");
    setLastSentAt(null);
    setAccuracy(null);
  }, [send]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  const isOn = state === "active" || state === "requesting";
  return { state, isOn, lastSentAt, accuracy, start, stop };
}
