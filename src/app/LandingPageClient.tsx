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
import ProgramHighlight from "@/components/landing/ProgramHighlight";
import ProcessSteps from "@/components/landing/ProcessSteps";
import TestimonialCarousel from "@/components/landing/TestimonialCarousel";
import CTABanner from "@/components/landing/CTABanner";

// Phase 0 공통 컴포넌트들
import SectionLayout from "@/components/ui/SectionLayout";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";

export default function LandingPageClient({
  initialSettings,
}: {
  initialSettings: any;
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
      <section className="bg-gradient-to-br from-brand-navy-900 via-blue-900 to-blue-800 text-white py-20 md:py-28 relative overflow-hidden">
        {/* 장식 도형 — 배경에 깊이감과 다이나믹 느낌 부여 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute right-0 top-0 w-[500px] h-[500px] border-[40px] border-white/5 rounded-full translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute left-0 bottom-0 w-80 h-80 border-[30px] border-brand-orange-500/20 rounded-full -translate-x-1/3 translate-y-1/3"></div>
          <div className="absolute right-1/4 bottom-1/4 w-32 h-32 bg-brand-orange-500/10 rounded-full blur-xl"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 relative">
          {/* 좌(텍스트) + 우(비주얼) 분할 레이아웃 */}
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            {/* 좌측: 텍스트 + CTA */}
            <div className="flex-1 max-w-xl">
              {/* 상단 뱃지 — 지역 No.1 포지셔닝 */}
              <div className="inline-block bg-brand-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-full mb-6 uppercase tracking-wider shadow">
                다산신도시 No.1 농구 전문 학원
              </div>

              {/* 메인 타이틀 — settings에서 가져온 동적 데이터 */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight tracking-tight">
                {settings.introductionTitle || "스티즈 농구교실"}
              </h1>

              {/* 소개 텍스트 — Tiptap HTML(dangerouslySetInnerHTML) 유지 필수 */}
              <div
                className="text-blue-100 text-lg mb-10 leading-relaxed [&_strong]:font-bold [&_em]:italic [&_p]:mb-1.5 [&_h1]:text-2xl [&_h1]:font-black [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-bold"
                dangerouslySetInnerHTML={{
                  __html: (() => {
                    const t = settings.introductionText;
                    if (!t)
                      return "아이들이 농구를 통해 협동심과 건강한 체력을 기를 수 있도록 최선을 다해 지도합니다.";
                    // HTML 태그가 포함되어 있으면 그대로, 아니면 줄바꿈을 <br>로
                    if (t.includes("<")) return t;
                    return t.replace(/\n/g, "<br>");
                  })(),
                }}
              />

              {/* 듀얼 CTA: 체험 신청(Primary) + 프로그램 보기(Ghost) */}
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/apply"
                  className="bg-brand-orange-500 hover:bg-brand-orange-600 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 shadow-lg text-base hover:scale-[1.02] hover:shadow-xl"
                >
                  체험 수업 신청
                </Link>
                <Link
                  href="/programs"
                  className="bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-4 rounded-xl transition-colors border border-white/30 text-base"
                >
                  프로그램 보기
                </Link>
              </div>
            </div>

            {/* 우측: 비주얼 영역 — 농구 그래픽 장식 */}
            <div className="flex-1 hidden lg:flex items-center justify-center">
              <div className="relative w-80 h-80">
                {/* 큰 농구공 실루엣 원 */}
                <div className="absolute inset-0 bg-brand-orange-500/20 rounded-full animate-pulse" />
                <div className="absolute inset-4 bg-brand-orange-500/30 rounded-full" />
                <div className="absolute inset-8 bg-brand-orange-500/20 rounded-full flex items-center justify-center">
                  <span className="text-8xl">🏀</span>
                </div>
                {/* 장식 링 */}
                <div className="absolute -top-4 -right-4 w-16 h-16 border-4 border-white/20 rounded-full" />
                <div className="absolute -bottom-2 -left-2 w-12 h-12 border-4 border-brand-orange-500/30 rounded-full" />
              </div>
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
          3. 프로그램 하이라이트
          - 기존 퀵네비 4개 카드를 프로그램 중심 카드로 대체
          - 유아반/초등저/초등고/중등반 4개 프로그램 카드
          ============================================= */}
      <ProgramHighlight />

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
                  <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200 aspect-video">
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
                    className="aspect-square relative rounded-xl overflow-hidden bg-gray-200 group"
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
                  className="inline-flex items-center gap-2 text-brand-orange-500 font-bold hover:text-brand-orange-600 transition-colors text-base"
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
      <TestimonialCarousel />

      {/* =============================================
          8. CTA 배너
          - 그라데이션 배경 + 듀얼 CTA
          - settings.contactPhone 사용
          ============================================= */}
      <CTABanner phone={phone} />
    </>
  );
}
