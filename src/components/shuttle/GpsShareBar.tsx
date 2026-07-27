"use client";

import type { GpsState } from "@/hooks/useGpsShare";

// 기사님 화면 — GPS 공유 상태 표시 전용 (토글 없음, 운행 시작/종료 버튼이 제어).
// ★ 라이트 모드 고정(기사님 화면 정책) — dark: 클래스 사용 금지.

function elapsedLabel(date: Date): string {
  const sec = Math.round((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${sec}초 전`;
  return `${Math.floor(sec / 60)}분 전`;
}

export default function GpsShareBar({
  gpsState, lastSentAt, accuracy,
}: {
  gpsState: GpsState;
  lastSentAt: Date | null;
  accuracy: number | null;
}) {
  return (
    <div className="mb-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2.5">
      <p className="text-[14px] font-bold text-green-800">
        📍{" "}
        {gpsState === "requesting" && "위치 권한 요청 중…"}
        {gpsState === "active" && !lastSentAt && "GPS 연결됨 · 첫 전송 준비 중"}
        {gpsState === "active" && lastSentAt && `위치 공유 중 · ${elapsedLabel(lastSentAt)}${accuracy != null ? ` · 정확도 ${Math.round(accuracy)}m` : ""}`}
        {gpsState === "denied" && "⚠️ 위치 권한 거부됨 — 브라우저 설정에서 허용해주세요"}
        {gpsState === "error"  && "⚠️ 위치를 가져오지 못했습니다"}
        {gpsState === "off"    && "위치 공유 꺼짐"}
      </p>
      {(gpsState === "active" || gpsState === "requesting") && (
        <p className="mt-0.5 text-[12px] font-semibold text-amber-700">
          ⚠️ 화면이 꺼지거나 다른 앱으로 이동하면 위치 공유가 중단됩니다
        </p>
      )}
    </div>
  );
}
