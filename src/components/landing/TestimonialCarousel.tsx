'use client';

/**
 * TestimonialCarousel — 학부모 후기 캐러셀 (Phase 2 메인 랜딩)
 *
 * 학부모 후기를 좌우 스크롤로 보여주는 캐러셀.
 * 외부 라이브러리 없이 CSS scroll-snap으로 구현 (번들 사이즈 절약).
 * (Brightwheel의 상세 고객 후기 패턴 참고)
 *
 * 초기에는 하드코딩된 후기 데이터를 사용하며,
 * 향후 DB 연동 시 props로 데이터를 전달하면 됨.
 *
 * Client Component — 캐러셀 좌우 버튼 클릭 이벤트 처리 필요
 */

import { useRef } from 'react';
import SectionLayout from '@/components/ui/SectionLayout';
import AnimateOnScroll from '@/components/ui/AnimateOnScroll';

// 후기 데이터 타입
interface Testimonial {
  name: string;        // 학부모 이름 (익명 처리)
  info: string;        // 학생 정보 (예: "초3 학부모")
  text: string;        // 후기 내용
  rating: number;      // 별점 (1~5)
}

interface TestimonialCarouselProps {
  testimonials?: Testimonial[];
}

// 기본 후기 데이터 — 하드코딩 (향후 DB 연동 가능)
const defaultTestimonials: Testimonial[] = [
  {
    name: '김O O',
    info: '초3 학부모',
    text: '아이가 운동에 관심이 없었는데, 여기 다니면서 매일 농구하자고 조릅니다. 코치님들이 정말 잘 이끌어주세요.',
    rating: 5,
  },
  {
    name: '이O O',
    info: '초1 학부모',
    text: '체험 수업 한 번 만에 바로 등록했습니다. 아이 눈높이에 맞는 수업이 인상적이었어요.',
    rating: 5,
  },
  {
    name: '박O O',
    info: '유아반 학부모',
    text: '6살인데 너무 즐거워합니다. 체력도 좋아지고 친구도 많이 사귀었어요. 감사합니다!',
    rating: 5,
  },
  {
    name: '최O O',
    info: '초5 학부모',
    text: '다른 학원 2곳 다녀봤는데 여기가 체계적이고 아이들도 가장 좋아합니다. 시설도 깨끗해요.',
    rating: 4,
  },
  {
    name: '정O O',
    info: '중1 학부모',
    text: '중학교 입학하고도 계속 다니고 있습니다. 대회 준비도 해주시고, 아이가 자신감이 많이 생겼어요.',
    rating: 5,
  },
];

export default function TestimonialCarousel({
  testimonials = defaultTestimonials,
}: TestimonialCarouselProps) {
  // 캐러셀 스크롤 컨테이너 참조
  const scrollRef = useRef<HTMLDivElement>(null);

  // 좌우 스크롤 함수 — 카드 하나 너비(320px)만큼 이동
  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 320;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // 별점 렌더링 — 채워진 별과 빈 별을 구분
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={i < rating ? 'text-yellow-400' : 'text-gray-200'}
      >
        ★
      </span>
    ));
  };

  return (
    <SectionLayout
      label="REVIEWS"
      title="학부모님들의 생생한 후기"
      description="스티즈 농구교실을 경험한 학부모님들의 이야기입니다"
      bgColor="section"
    >
      <AnimateOnScroll>
        <div className="relative">
          {/* 좌측 스크롤 버튼 */}
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center hover:shadow-lg transition-shadow cursor-pointer hidden md:flex"
            aria-label="이전 후기"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* 캐러셀 스크롤 컨테이너 — CSS scroll-snap으로 카드 정렬 */}
          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 scrollbar-hide"
            style={{
              // 스크롤바 숨기기 (크로스 브라우저)
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {testimonials.map((item, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-[280px] md:w-[320px] snap-start bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
                {/* 별점 */}
                <div className="text-lg mb-3">{renderStars(item.rating)}</div>

                {/* 후기 내용 — 따옴표로 감싸서 후기 느낌 강조 */}
                <p className="text-gray-600 text-sm leading-relaxed mb-4 min-h-[80px]">
                  &ldquo;{item.text}&rdquo;
                </p>

                {/* 학부모 정보 */}
                <div className="border-t border-gray-100 pt-3">
                  <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.info}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 우측 스크롤 버튼 */}
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center hover:shadow-lg transition-shadow cursor-pointer hidden md:flex"
            aria-label="다음 후기"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </AnimateOnScroll>

      {/* 모바일 스크롤 안내 */}
      <p className="text-center text-xs text-gray-400 mt-4 md:hidden">
        좌우로 밀어서 더 많은 후기를 확인하세요
      </p>
    </SectionLayout>
  );
}
