"use client";

/**
 * PublicHeader — 통합 공개 페이지 헤더 (Phase 1)
 *
 * 메인 랜딩(LandingPageClient)과 서브페이지(PublicPageLayout) 양쪽에서
 * 사용하던 헤더를 하나로 통합한 컴포넌트.
 *
 * Client Component인 이유:
 * - 모바일 햄버거 메뉴 열기/닫기에 useState가 필요
 * - 스크롤 시 헤더 배경 변화에 useEffect가 필요
 *
 * props로 settings 데이터(phone, address)를 Server Component 부모에서 받아온다.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

// 부모(Server Component)에서 전달받을 props 타입
interface PublicHeaderProps {
  phone: string;
  address: string;
}

// 통합 네비게이션 메뉴 항목 — PublicPageLayout 기준으로 7개 전부 포함
const NAV_ITEMS = [
  { href: "/about", label: "학원/멤버소개" },
  { href: "/programs", label: "프로그램안내" },
  { href: "/schedule", label: "수업시간표" },
  { href: "/simulator", label: "수업시뮬레이터" },
  { href: "/annual", label: "연간일정표" },
  { href: "/gallery", label: "포토갤러리" },
  { href: "/notices", label: "공지사항" },
  { href: "/apply", label: "체험/수강신청" },
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

          {/* 데스크탑 네비게이션 — 호버 시 밑줄 슬라이드 인 효과 */}
          <nav className="hidden md:flex items-center gap-6 font-bold text-sm text-gray-700">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative py-1 hover:text-brand-orange-500 transition-colors group"
              >
                {item.label}
                {/* 밑줄 슬라이드 인: 호버 시 왼쪽에서 오른쪽으로 밑줄이 나타남 */}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-orange-500 transition-all duration-300 group-hover:w-full" />
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

            {/* 체험 신청 CTA 버튼 — 전화문의 대신 체험 신청으로 변경 (설계 계획서 방향) */}
            <Link
              href="/apply"
              className={[
                "bg-brand-orange-500 hover:bg-brand-orange-600 text-white font-bold",
                "px-4 py-2 rounded-xl text-sm transition-all duration-200",
                "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
                "hidden sm:inline-flex items-center",
              ].join(" ")}
            >
              체험 신청
            </Link>

            {/* 모바일 햄버거 버튼 */}
            <button
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

      {/* 모바일 사이드바 — 오른쪽에서 슬라이드 인 */}
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

        {/* 사이드바 메뉴 항목 */}
        <nav className="py-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-6 py-3 text-gray-700 font-medium hover:bg-brand-orange-50 hover:text-brand-orange-500 transition-colors"
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
            체험 신청하기
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
