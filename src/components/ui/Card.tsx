/**
 * Card — 공통 카드 컴포넌트 (Phase 0 디자인 시스템)
 *
 * 4종 카드를 제공한다:
 * - default: 기본 흰 배경 카드 (호버 시 위로 살짝 뜸)
 * - accent: 좌측에 색상 바가 있는 강조 카드 (프로그램 구분 등)
 * - image: 상단에 이미지가 있는 카드 (프로그램/갤러리 등)
 * - info: 배경색이 있는 정보 카드 (통계/안내 등)
 *
 * Server Component 가능 (상태/이벤트 없음)
 */

import Image from 'next/image';

type CardVariant = 'default' | 'accent' | 'image' | 'info';

interface CardBaseProps {
  children: React.ReactNode;
  className?: string;
}

// accent 카드 전용: 좌측 바 색상 지정
interface AccentCardProps extends CardBaseProps {
  variant: 'accent';
  accentColor?: string; // Tailwind 클래스 (예: 'bg-brand-orange-500')
  imageSrc?: never;
  imageAlt?: never;
}

// image 카드 전용: 상단 이미지 경로/alt
interface ImageCardProps extends CardBaseProps {
  variant: 'image';
  imageSrc: string;
  imageAlt: string;
  accentColor?: never;
}

// default/info 카드: 추가 props 없음
interface SimpleCardProps extends CardBaseProps {
  variant?: 'default' | 'info';
  accentColor?: never;
  imageSrc?: never;
  imageAlt?: never;
}

type CardProps = AccentCardProps | ImageCardProps | SimpleCardProps;

// 각 variant별 스타일 매핑
const variantStyles: Record<CardVariant, string> = {
  // 기본 카드: 흰 배경, 얇은 테두리, 호버 시 위로 뜨며 그림자 강해짐
  default: [
    'bg-white border border-gray-100 rounded-2xl shadow-sm',
    'hover:shadow-md hover:-translate-y-1',
  ].join(' '),

  // 강조 카드: 좌측 4px 색상 바 + 호버 시 그림자와 살짝 확대
  accent: [
    'bg-white border border-gray-100 rounded-2xl shadow-sm',
    'hover:shadow-lg hover:scale-[1.01]',
  ].join(' '),

  // 이미지 카드: 상단 이미지 영역 + 호버 시 그림자 강해짐
  image: [
    'bg-white border border-gray-100 rounded-2xl shadow-md overflow-hidden',
    'hover:shadow-xl',
  ].join(' '),

  // 정보 카드: 따뜻한 배경, 테두리 없음, 호버 시 흰 배경으로
  info: [
    'bg-surface-section rounded-xl',
    'hover:bg-white hover:shadow-sm',
  ].join(' '),
};

export default function Card({
  variant = 'default',
  children,
  className = '',
  accentColor = 'bg-brand-orange-500',
  imageSrc,
  imageAlt,
}: CardProps) {
  return (
    <div
      className={[
        // 모든 카드에 공통: 부드러운 전환 효과
        'transition-all duration-300',
        variantStyles[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* accent 카드: 좌측 색상 바를 border-left로 표현 */}
      {variant === 'accent' && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${accentColor}`} />
      )}

      {/* image 카드: 상단 이미지 영역 (호버 시 이미지가 살짝 확대됨) */}
      {variant === 'image' && imageSrc && (
        <div className="relative w-full h-48 overflow-hidden">
          <Image
            src={imageSrc}
            alt={imageAlt || ''}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      )}

      {/* 카드 본문 영역 */}
      <div
        className={[
          // accent 카드는 좌측 바 공간 확보를 위해 relative + 좌측 패딩 추가
          variant === 'accent' ? 'relative pl-5' : '',
          // image 카드의 본문은 별도 패딩
          variant === 'image' ? 'p-5' : '',
          // default/info 카드는 기본 패딩
          variant === 'default' || variant === 'info' ? 'p-6' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
