"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";

/**
 * ProgramAccordionTerms — 이용약관 아코디언 컴포넌트
 *
 * 이용약관 전문을 바로 노출하면 페이지가 길어지므로,
 * 접기/펼치기 방식으로 사용자가 필요할 때만 펼쳐볼 수 있게 한다.
 * ApplyPageClient의 FAQItem 아코디언 스타일과 일관성을 유지한다.
 */
export default function ProgramAccordionTerms({
  termsText,
}: {
  termsText: string | null;
}) {
  // React hooks 규칙: useState는 조건문 앞에 호출해야 함
  const [isOpen, setIsOpen] = useState(false);

  // termsText가 null이면 아무것도 렌더링하지 않음
  if (!termsText) return null;

  return (
    <Card variant="default" className="!p-0 overflow-hidden">
      {/* 아코디언 헤더 — 클릭 시 본문 토글 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 px-6 text-left hover:text-brand-orange-500 transition-colors cursor-pointer"
      >
        <span className="font-semibold text-gray-900 text-lg">이용약관</span>
        {/* ChevronDown 아이콘 — 열림 시 180도 회전 (lucide 스타일 SVG) */}
        <svg
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* 약관 본문 — isOpen일 때만 표시, 부드러운 전환 */}
      {isOpen && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <p className="text-gray-600 text-base leading-relaxed whitespace-pre-line pt-4">
            {termsText}
          </p>
        </div>
      )}
    </Card>
  );
}
