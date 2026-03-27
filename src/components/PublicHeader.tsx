"use client";

/**
 * PublicHeader — 통합 공개 페이지 헤더
 *
 * 카테고리 드롭다운 방식:
 * - PC(md 이상): group/group-hover CSS 드롭다운 (JS 상태 불필요)
 * - 모바일(md 미만): 카테고리 라벨 + 구분선으로 시각 그룹핑
 *
 * 메뉴 구조:
 *   학원 안내 v | 수업 안내 v | 수업찾기 | [신청하기]
 *   + FAQ, 이용약관은 드롭다운 하위에 배치
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown } from "lucide-react";

// 부모(Server Component)에서 전달받을 props 타입
interface PublicHeaderProps {
  phone: string;
  address: string;
}

// ---------- 메뉴 데이터 구조 ----------

// 카테고리 드롭다운 그룹 — 각 그룹은 hover 시 하위 메뉴가 펼쳐진다
const NAV_GROUPS = [
  {
    label: "학원 안내",
    items: [
      { href: "/about", label: "학원/멤버소개" },
      { href: "/gallery", label: "포토갤러리" },
      { href: "/notices", label: "공지사항" },
      { href: "/apply#faq", label: "자주 묻는 질문" },
      { href: "/programs#terms", label: "이용약관" },
    ],
  },
  {
    label: "수업 안내",
    items: [
      { href: "/programs", label: "프로그램안내" },
      { href: "/schedule", label: "수업시간표" },
      { href: "/annual", label: "연간일정표" },
    ],
  },
];

// 독립 메뉴 — 드롭다운 없이 바로 링크
const NAV_STANDALONE = [
  { href: "/simulator", label: "수업찾기" },
];

export default function PublicHeader({ phone, address }: PublicHeaderProps) {
  // 모바일 사이드바 열림/닫힘 상태
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 스크롤 위치 추적 — 스크롤하면 헤더 배경을 불투명하게 만든다 (glassmorphism)
  const [isScrolled, setIsScrolled] = useState(false);

  // 큰글씨 모드 상태 — localStorage에 저장하여 새로고침 후에도 유지
  const [isLargeFont, setIsLargeFont] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // 50px 이상 스크롤하면 배경 변경
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    // 초기 상태도 확인 (페이지 중간에서 새로고침할 수 있으므로)
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 큰글씨 모드: localStorage에서 초기값 로드 (SSR 호환을 위해 useEffect 안에서 실행)
  useEffect(() => {
    const saved = localStorage.getItem("fontSize");
    if (saved === "large") {
      setIsLargeFont(true);
      document.documentElement.classList.add("text-large");
    }
  }, []);

  // 큰글씨 모드 토글 핸들러
  const toggleFontSize = () => {
    const nextIsLarge = !isLargeFont;
    setIsLargeFont(nextIsLarge);
    if (nextIsLarge) {
      document.documentElement.classList.add("text-large");
      localStorage.setItem("fontSize", "large");
    } else {
      document.documentElement.classList.remove("text-large");
      localStorage.setItem("fontSize", "normal");
    }
  };

  // 모바일 메뉴가 열려있을 때 body 스크롤 방지
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      {/* 유틸리티 바 — 운영시간 + 전화번호 (데스크탑만 표시) */}
      <div className="bg-brand-navy-900 text-white text-xs py-2 hidden md:block">
        <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
          <span className="text-gray-300">
            평일 13:00~21:00 / 토 09:00~18:00 (일요일·공휴일 휴무)
          </span>
          <div className="flex items-center gap-3">
            <span>상담문의: {phone}</span>
            {/* 큰글씨 모드 토글 — 학부모 편의를 위한 글씨 크기 변경 버튼 */}
            <button
              onClick={toggleFontSize}
              className={[
                "flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-colors",
                isLargeFont
                  ? "bg-brand-orange-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600",
              ].join(" ")}
              aria-label={isLargeFont ? "기본 글씨 크기로 변경" : "큰 글씨 모드로 변경"}
              title={isLargeFont ? "기본 글씨" : "큰 글씨"}
            >
              <span className="text-sm font-black leading-none">가</span>
              <span className="leading-none">{isLargeFont ? "크게" : "보통"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 메인 헤더 — 스크롤 시 glassmorphism 효과 적용 */}
      <header
        className={[
          "sticky top-0 z-50 transition-all duration-300",
          isScrolled
            ? "bg-white/95 backdrop-blur-md shadow-md border-b border-gray-100"
            : "bg-white shadow-sm border-b border-gray-100",
        ].join(" ")}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          {/* 로고 + 지점명 */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <Image
              src="/stiz-logo.png"
              alt="STIZ"
              width={180}
              height={45}
              className="h-10 sm:h-12 w-auto object-contain"
              priority
            />
            <span className="font-extrabold text-lg sm:text-xl text-brand-navy-900">
              다산점
            </span>
          </Link>

          {/* ===== 데스크탑 네비게이션 ===== */}
          <nav className="hidden md:flex items-center gap-1 font-bold text-sm text-gray-700">
            {/* 카테고리 드롭다운 그룹 — group/group-hover CSS로 구현 (JS 상태 불필요) */}
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="relative group">
                {/* 카테고리 라벨 버튼 — hover 시 드롭다운이 열린다 */}
                <button
                  className="flex items-center gap-1 px-3 py-2 rounded-lg hover:text-brand-orange-500 hover:bg-brand-orange-50 transition-colors"
                >
                  {group.label}
                  {/* 화살표 — hover 시 회전 */}
                  <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-180" />
                </button>

                {/* 드롭다운 패널 — group-hover로 보이기/숨기기 */}
                <div className="absolute top-full left-0 pt-1 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200">
                  <div className="bg-white rounded-lg shadow-lg border border-gray-100 py-2 min-w-[180px]">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        // data-tour-target: href에서 슬래시 제거 + 해시는 하이픈으로 변환
                        data-tour-target={`nav-${item.href.slice(1).replace("#", "-")}`}
                        className="block px-4 py-2.5 text-gray-600 hover:text-brand-orange-500 hover:bg-brand-orange-50 transition-colors text-sm font-medium"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* 독립 메뉴 — 드롭다운 없이 직접 링크 */}
            {NAV_STANDALONE.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-tour-target={`nav-${item.href.slice(1)}`}
                className="relative px-3 py-2 rounded-lg hover:text-brand-orange-500 hover:bg-brand-orange-50 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* 큰글씨 모드 토글 (모바일 전용) — 유틸리티 바가 안 보이는 모바일에서도 접근 가능 */}
            <button
              onClick={toggleFontSize}
              className={[
                "md:hidden flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors",
                isLargeFont
                  ? "bg-brand-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              ].join(" ")}
              aria-label={isLargeFont ? "기본 글씨 크기로 변경" : "큰 글씨 모드로 변경"}
            >
              <span className="text-sm font-black leading-none">가</span>
            </button>

            {/* CTA 버튼 — "신청하기"로 변경 */}
            <Link
              href="/apply"
              className={[
                "bg-brand-orange-500 hover:bg-brand-orange-600 text-white font-bold",
                "px-4 py-2 rounded-xl text-sm transition-all duration-200",
                "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
                "hidden sm:inline-flex items-center",
              ].join(" ")}
            >
              신청하기
            </Link>

            {/* 모바일 햄버거 버튼 */}
            <button
              data-tour-target="hamburger"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="메뉴 열기"
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
          </div>
        </div>
      </header>

      {/* 모바일 사이드바 오버레이 — 배경 딤 처리 */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ===== 모바일 사이드바 — 카테고리 라벨 + 구분선으로 그룹핑 ===== */}
      <div
        className={[
          "fixed top-0 right-0 z-[70] h-full w-72 bg-white shadow-2xl",
          "transform transition-transform duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* 사이드바 상단 — 닫기 버튼 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <span className="font-bold text-brand-navy-900">메뉴</span>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* 사이드바 메뉴 — 카테고리별 라벨 + 하위 링크 + 구분선 */}
        <nav className="py-2 overflow-y-auto" style={{ maxHeight: "calc(100% - 200px)" }}>
          {/* 카테고리 그룹들 */}
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={group.label}>
              {/* 카테고리 라벨 — 작은 회색 텍스트로 그룹 구분 */}
              <div className="px-6 pt-4 pb-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {group.label}
                </span>
              </div>
              {/* 하위 메뉴 링크들 */}
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour-target={`mobile-nav-${item.href.slice(1).replace("#", "-")}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-6 py-2.5 text-gray-700 font-medium hover:bg-brand-orange-50 hover:text-brand-orange-500 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              {/* 그룹 사이 구분선 */}
              {groupIdx < NAV_GROUPS.length - 1 && (
                <div className="mx-4 my-2 border-t border-gray-100" />
              )}
            </div>
          ))}

          {/* 독립 메뉴 — 구분선 후 표시 */}
          <div className="mx-4 my-2 border-t border-gray-100" />
          {NAV_STANDALONE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-tour-target={`mobile-nav-${item.href.slice(1)}`}
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-6 py-3 text-gray-700 font-semibold hover:bg-brand-orange-50 hover:text-brand-orange-500 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 사이드바 하단 — 연락처 + CTA */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50">
          <Link
            href="/apply"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block w-full bg-brand-orange-500 hover:bg-brand-orange-600 text-white font-bold py-3 rounded-xl text-center transition-colors mb-3"
          >
            신청하기
          </Link>
          <a
            href={`tel:${phone.replace(/-/g, "")}`}
            className="block text-center text-sm text-gray-500 hover:text-brand-navy-900 transition-colors"
          >
            상담전화: {phone}
          </a>
          {/* 모바일 사이드바 내 큰글씨 모드 토글 */}
          <button
            onClick={toggleFontSize}
            className={[
              "w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors",
              isLargeFont
                ? "bg-brand-orange-100 text-brand-orange-600 border border-brand-orange-200"
                : "bg-gray-100 text-gray-600 border border-gray-200",
            ].join(" ")}
          >
            <span className="text-base font-black">가</span>
            <span>{isLargeFont ? "큰글씨 모드 켜짐" : "큰글씨 모드"}</span>
          </button>
        </div>
      </div>
    </>
  );
}
