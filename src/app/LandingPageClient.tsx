"use client";

/**
 * LandingPageClient — 메인 랜딩 페이지 콘텐츠 (Phase 2 개편)
 *
 * Phase 2 변경사항:
 * - 히어로 섹션을 좌 텍스트 + 우 이미지 분할 레이아웃으로 변경
 * - 듀얼 CTA: "체험 신청"(Primary) + "프로그램 보기"(Ghost)
 * - TrustBadges, ProgramHighlight, ProcessSteps, TestimonialCarousel, CTABanner 추가
 * - 기존 유튜브/갤러리 섹션은 SectionLayout으로 감싸서 스타일 개선
 * - settings 데이터 의존성 모두 유지 (introductionTitle, introductionText,
 *   youtubeUrl, galleryImagesJSON, contactPhone, address)
 * - dangerouslySetInnerHTML 유지 (Tiptap HTML 지원)
 * - revalidate 값 변경 없음 (page.tsx에서 관리)
 */

import Link from "next/link";
import Image from "next/image";

// Phase 2 신규 컴포넌트들
import TrustBadges from "@/components/landing/TrustBadges";
import ProcessSteps from "@/components/landing/ProcessSteps";
import TestimonialCarousel from "@/components/landing/TestimonialCarousel";
import CTABanner from "@/components/landing/CTABanner";

// Phase 0 공통 컴포넌트들
import SectionLayout from "@/components/ui/SectionLayout";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import { sanitizeHtml } from "@/lib/sanitize";

export default function LandingPageClient({
  initialSettings,
  testimonials,
  naverPlaceUrl,
}: {
  initialSettings: any;
  testimonials?: { name: string; info: string; text: string; rating: number }[];
  naverPlaceUrl?: string;
}) {
  const settings = initialSettings || {};
  const phone = settings.contactPhone || "010-0000-0000";

  return (
    <>
      {/* =============================================
          1. 히어로 섹션
          - 좌: 텍스트(소개 제목 + 설명) + 듀얼 CTA
          - 우: 장식 도형 (이미지 미등록 시 그래픽으로 대체)
          - settings.introductionTitle, settings.introductionText 의존성 유지
          - dangerouslySetInnerHTML 유지 (Tiptap HTML 지원)
          ============================================= */}
      <section className="bg-gradient-to-br from-brand-navy-900 via-blue-900 to-blue-800 dark:from-black dark:via-gray-900 dark:to-black text-white py-8 md:py-12 relative overflow-hidden transition-colors duration-300">
        {/* 장식 도형 — 배경에 깊이감과 다이나믹 느낌 부여 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute right-0 top-0 w-[500px] h-[500px] border-[40px] border-white/5 dark:border-brand-neon-cobalt/10 rounded-full translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute left-0 bottom-0 w-80 h-80 border-[30px] border-brand-orange-500/20 dark:border-brand-neon-lime/20 rounded-full -translate-x-1/3 translate-y-1/3"></div>
          <div className="absolute right-1/4 bottom-1/4 w-32 h-32 bg-brand-orange-500/10 dark:bg-brand-neon-cobalt/20 rounded-full blur-xl"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 relative">
          {/* 좌(비주얼) + 우(텍스트) 분할 레이아웃 */}
          <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-12">
            {/* 좌측: 비주얼 영역 — 농구 그래픽 장식 */}
            <div className="flex-1 hidden lg:flex items-center justify-center">
              <div className="relative w-64 h-64">
                <div className="absolute inset-0 bg-brand-orange-500/20 dark:bg-brand-neon-lime/20 rounded-full animate-pulse" />
                <div className="absolute inset-4 bg-brand-orange-500/30 dark:bg-brand-neon-lime/30 rounded-full" />
                <div className="absolute inset-8 bg-brand-orange-500/20 dark:bg-brand-neon-lime/20 rounded-full flex items-center justify-center">
                  <span className="text-7xl">🏀</span>
                </div>
                <div className="absolute -top-4 -right-4 w-16 h-16 border-4 border-white/20 dark:border-brand-neon-cobalt/30 rounded-full" />
                <div className="absolute -bottom-2 -left-2 w-12 h-12 border-4 border-brand-orange-500/30 dark:border-brand-neon-lime/40 rounded-full" />
              </div>
            </div>

            {/* 우측: 텍스트 (우정렬) */}
            <div className="flex-1 max-w-xl lg:text-right">
              {/* 상단 뱃지 — 지역 No.1 포지셔닝 */}
              <div className="inline-block bg-brand-orange-500 dark:bg-brand-neon-lime text-white dark:text-brand-navy-900 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider shadow dark:shadow-brand-neon-lime/30">
                다산신도시 No.1 농구 전문 학원
              </div>

              {/* 메인 타이틀 — settings에서 가져온 동적 데이터 */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 leading-tight tracking-tight">
                {settings.introductionTitle || "스티즈 농구교실"}
              </h1>

              {/* 소개 텍스트 — Tiptap HTML(dangerouslySetInnerHTML) 유지 필수 */}
              <div
                className="text-blue-100 dark:text-gray-300 [&_*]:!text-blue-100 dark:[&_*]:!text-gray-300 text-base leading-relaxed [&_strong]:font-bold [&_em]:italic [&_p]:mb-1 [&_h1]:text-2xl [&_h1]:font-black [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-bold transition-colors"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml((() => {
                    const t = settings.introductionText;
                    if (!t)
                      return "아이들이 농구를 통해 협동심과 건강한 체력을 기를 수 있도록 최선을 다해 지도합니다.";
                    if (t.includes("<")) return t;
                    return t.replace(/\n/g, "<br>");
                  })()),
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* =============================================
          2. 신뢰 지표 바
          - 운영 기간 / 수강생 수 / 만족도 / 코치진 숫자
          - 히어로 바로 아래에 위치하여 첫인상에서 신뢰감 형성
          ============================================= */}
      <TrustBadges />

      {/* =============================================
          4. 수강 과정 시각화
          - 상담 → 체험 → 등록 → 수업 4단계
          - 학부모가 진입 과정을 한눈에 파악
          ============================================= */}
      <ProcessSteps />

      {/* =============================================
          5. 유튜브 영상 섹션
          - settings.youtubeUrl이 있을 때만 표시 (기존 로직 유지)
          - SectionLayout으로 감싸서 일관된 스타일 적용
          ============================================= */}
      {settings.youtubeUrl &&
        (() => {
          const raw = settings.youtubeUrl as string;
          // iframe embed 코드 붙여넣기 지원: src="..." 에서 URL 추출
          const srcMatch = raw.match(/src=["']([^"']+)["']/);
          const url = srcMatch ? srcMatch[1] : raw;
          const match = url.match(
            /(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/
          );
          const videoId = match?.[1];
          if (!videoId) return null;
          return (
            <SectionLayout
              label="VIDEO"
              title="스티즈 농구교실 영상"
              bgColor="white"
            >
              <div className="max-w-4xl mx-auto">
                <AnimateOnScroll>
                  <div className="rounded-2xl overflow-hidden shadow-lg dark:shadow-brand-neon-cobalt/20 border border-gray-200 dark:border-gray-800 aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                      title="STIZ 농구교실 소개"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                </AnimateOnScroll>
              </div>
            </SectionLayout>
          );
        })()}

      {/* =============================================
          6. 갤러리 하이라이트
          - settings.galleryImagesJSON에서 최근 사진 8장까지 표시
          - SectionLayout으로 감싸서 스타일 통일
          - "더보기" 링크 → /gallery
          ============================================= */}
      {(() => {
        let galleryImages: string[] = [];
        try {
          if (settings.galleryImagesJSON)
            galleryImages = JSON.parse(settings.galleryImagesJSON);
        } catch {}
        if (galleryImages.length === 0) return null;
        // 최대 8장까지만 표시
        const displayImages = galleryImages.slice(0, 8);
        return (
          <SectionLayout
            label="GALLERY"
            title="학원 활동 사진"
            description="아이들의 즐거운 농구 수업 모습을 확인하세요"
            bgColor="section"
          >
            <AnimateOnScroll>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {displayImages.map((url, i) => (
                  <div
                    key={i}
                    className="aspect-square relative rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 group"
                  >
                    <Image
                      src={url}
                      alt={`학원 활동 사진 ${i + 1}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                    {/* 호버 시 반투명 오버레이 */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  </div>
                ))}
              </div>
            </AnimateOnScroll>

            {/* 갤러리 더보기 링크 */}
            {galleryImages.length > 8 && (
              <div className="text-center mt-8">
                <Link
                  href="/gallery"
                  className="inline-flex items-center gap-2 text-brand-orange-500 dark:text-brand-neon-lime font-bold hover:text-brand-orange-600 dark:text-brand-neon-lime dark:hover:text-lime-400 transition-colors text-base"
                >
                  더 많은 사진 보기
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </SectionLayout>
        );
      })()}

      {/* =============================================
          7. 학부모 후기 섹션
          - CSS scroll-snap 캐러셀로 좌우 스크롤
          - 초기 하드코딩, 향후 DB 연동 가능
          ============================================= */}
      <TestimonialCarousel testimonials={testimonials} naverPlaceUrl={naverPlaceUrl} />

      {/* =============================================
          8. CTA 배너
          - 그라데이션 배경 + 듀얼 CTA
          - settings.contactPhone 사용
          ============================================= */}
      <CTABanner phone={phone} />
    </>
  );
}
