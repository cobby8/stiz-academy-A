"use client";

import { useGpsShare } from "@/hooks/useGpsShare";

// 기사님 화면 상단 GPS 위치 공유 바.
// ★ 라이트 모드 고정(기사님 화면 정책) — dark: 클래스 사용 금지.

function elapsedLabel(date: Date): string {
  const sec = Math.round((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${sec}초 전`;
  return `${Math.floor(sec / 60)}분 전`;
}

export default function GpsShareBar({ token, label }: { token: string; label?: string }) {
  const { state, isOn, lastSentAt, accuracy, start, stop } = useGpsShare(token, label);

  return (
    <div className={`mb-3 rounded-2xl border-2 p-3.5 ${isOn ? "border-green-400 bg-green-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-black text-gray-800">📍 위치 공유</p>
          <p className="text-[13px] font-semibold text-gray-500 leading-snug">
            {state === "off"       && "꺼짐 — 관리자가 차량 위치를 볼 수 없습니다"}
            {state === "requesting" && "위치 권한 요청 중…"}
            {state === "active"    && !lastSentAt && "GPS 연결됨 · 첫 전송 준비 중"}
            {state === "active"    && lastSentAt  && `전송 중 · ${elapsedLabel(lastSentAt)}${accuracy != null ? ` · 정확도 ${Math.round(accuracy)}m` : ""}`}
            {state === "denied"    && "⚠️ 위치 권한 거부됨 — 브라우저 설정에서 허용 후 다시 누르세요"}
            {state === "error"     && "⚠️ 위치를 가져오지 못했습니다 — 다시 시도해주세요"}
          </p>
        </div>
        <button
          type="button"
          onClick={isOn ? stop : start}
          className={`h-13 min-w-[80px] shrink-0 rounded-xl text-[16px] font-black transition-colors ${
            state === "requesting"
              ? "bg-yellow-400 text-gray-900"
              : isOn
              ? "bg-green-600 text-white"
              : "border-2 border-gray-300 text-gray-600"
          }`}
        >
          {state === "requesting" ? "확인 중" : isOn ? "켜짐" : "꺼짐"}
        </button>
      </div>
      {isOn && (
        <p className="mt-2 text-[13px] font-bold text-amber-700">
          ⚠️ 화면이 꺼지거나 다른 앱으로 이동하면 위치 공유가 중단됩니다
        </p>
      )}
    </div>
  );
}
