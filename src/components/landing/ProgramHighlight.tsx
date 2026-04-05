/**
 * ProgramHighlight — 프로그램 하이라이트 카드 (Phase 2 메인 랜딩)
 *
 * 핵심 프로그램 3~4개를 이미지 카드로 보여주는 섹션.
 * 기존 퀵네비 4개 카드를 대체하여, 프로그램 중심의 콘텐츠로 전환.
 * (Brightwheel 모듈 카드 패턴 참고)
 *
 * 각 카드 클릭 시 /programs 페이지로 이동.
 * SectionLayout + AnimateOnScroll 적용.
 */

import Link from 'next/link';
import SectionLayout from '@/components/ui/SectionLayout';
import AnimateOnScroll from '@/components/ui/AnimateOnScroll';

// 프로그램 카드 데이터 타입
interface ProgramItem {
  title: string;       // 프로그램 이름
  ageRange: string;    // 대상 연령 (예: "6~7세")
  description: string; // 한줄 설명
  color: string;       // 카드 상단 색상 바 Tailwind 클래스
  icon: string;        // 이모지 아이콘
}

// 기본 프로그램 데이터 — 하드코딩 (향후 DB programs 테이블 연동 가능)
const programs: ProgramItem[] = [
  {
    title: '유아반',
    ageRange: '6~7세',
    description: '농구를 처음 접하는 아이들을 위한 놀이 중심 수업',
    color: 'bg-emerald-500',
    icon: '🌱',
  },
  {
    title: '초등 저학년반',
    ageRange: '초1~초3',
    description: '기초 체력과 농구 기본기를 다지는 체계적 수업',
    color: 'bg-blue-500',
    icon: '⛹️',
  },
  {
    title: '초등 고학년반',
    ageRange: '초4~초6',
    description: '전술 이해와 팀 플레이를 배우는 실전 중심 수업',
    color: 'bg-purple-500',
    icon: '🏀',
  },
  {
    title: '중등반',
    ageRange: '중1~중3',
    description: '경기력 향상과 대회 준비를 위한 심화 훈련',
    color: 'bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900',
    icon: '🏆',
  },
];

export default function ProgramHighlight() {
  return (
    <SectionLayout
      label="PROGRAMS"
      title="수준별 맞춤 클래스"
      description="아이의 나이와 실력에 맞는 최적의 프로그램을 운영합니다"
      bgColor="section"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
        {programs.map((program, index) => (
          <AnimateOnScroll key={program.title} delay={index * 100}>
            <Link
              href="/programs"
              className="block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
            >
              {/* 카드 상단: 색상 바 + 아이콘 — 프로그램별 색상으로 시각 구분 */}
              <div className={`${program.color} h-2`} />
              <div className="p-5 md:p-6">
                <div className="text-3xl mb-3">{program.icon}</div>
                {/* 프로그램 이름 */}
                <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-brand-orange-500 dark:text-brand-neon-lime transition-colors">
                  {program.title}
                </h3>
                {/* 대상 연령 — 뱃지 스타일 */}
                <span className="inline-block bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-medium px-2 py-0.5 rounded-full mb-3">
                  {program.ageRange}
                </span>
                {/* 프로그램 설명 */}
                <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed">
                  {program.description}
                </p>
              </div>
            </Link>
          </AnimateOnScroll>
        ))}
      </div>

      {/* 전체 프로그램 보기 링크 */}
      <div className="text-center mt-10">
        <Link
          href="/programs"
          className="inline-flex items-center gap-2 text-brand-orange-500 dark:text-brand-neon-lime font-bold hover:text-brand-orange-600 dark:text-brand-neon-lime dark:hover:text-lime-400 transition-colors text-base"
        >
          전체 프로그램 보기
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </SectionLayout>
  );
}
