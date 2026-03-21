/**
 * ChatBotButton — 우하단 플로팅 말풍선 버튼
 *
 * 모든 공개 페이지에 표시되는 둥근 원형 버튼.
 * 클릭하면 ChatPanel(채팅 패널)이 열리고, 다시 클릭하면 닫힌다.
 * fixed 포지션이라 스크롤해도 항상 화면 우하단에 고정된다.
 */
"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import ChatPanel from "./ChatPanel";

export default function ChatBotButton() {
  // 채팅 패널의 열림/닫힘 상태
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 채팅 패널이 열려 있으면 표시 */}
      {isOpen && <ChatPanel onClose={() => setIsOpen(false)} />}

      {/* 플로팅 말풍선 버튼 — 패널이 닫혀 있을 때만 표시 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="
            fixed bottom-6 right-6 z-50
            w-14 h-14 rounded-full
            bg-orange-500 text-white
            shadow-lg hover:bg-orange-600
            transition-all duration-200 hover:scale-105
            flex items-center justify-center
          "
          aria-label="상담 챗봇 열기"
        >
          <MessageCircle size={26} />
        </button>
      )}
    </>
  );
}
