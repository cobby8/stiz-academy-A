/**
 * Button — 공통 버튼 컴포넌트 (Phase 0 디자인 시스템)
 *
 * 5종 버튼을 제공한다:
 * - primary: 오렌지 배경, 가장 눈에 띄는 행동 유도 버튼
 * - secondary: 네이비 배경, 보조 행동 버튼
 * - ghost: 투명 배경 + 오렌지 테두리, 덜 강조할 때
 * - white: 흰 배경, 어두운 배경 위에서 사용
 * - cta: 큰 CTA 버튼, 히어로/배너에서 사용
 *
 * Server Component 가능 (상태/이벤트 없음)
 */

import { type ButtonHTMLAttributes } from 'react';

// 버튼 종류 (variant)와 크기 (size) 타입 정의
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'white' | 'cta';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  className?: string;
}

// 각 variant별 스타일 매핑
const variantStyles: Record<ButtonVariant, string> = {
  // Primary: 오렌지 배경 → 호버 시 한 단계 진한 오렌지 + 살짝 커짐
  primary: [
    'bg-brand-orange-500 text-white',
    'hover:bg-brand-orange-600 hover:scale-[1.02] hover:shadow-lg',
    'active:scale-[0.98]',
    'focus:ring-2 focus:ring-brand-orange-500/50 focus:ring-offset-2',
    'rounded-xl',
  ].join(' '),

  // Secondary: 네이비 배경 → 호버 시 약간 밝은 네이비
  secondary: [
    'bg-brand-navy-900 text-white',
    'hover:bg-brand-navy-800 hover:scale-[1.02]',
    'active:scale-[0.98]',
    'focus:ring-2 focus:ring-brand-orange-500/50 focus:ring-offset-2',
    'rounded-xl',
  ].join(' '),

  // Ghost: 투명 배경 + 오렌지 텍스트/테두리 → 호버 시 배경에 살짝 오렌지 톤
  ghost: [
    'bg-transparent text-brand-orange-500 border border-brand-orange-500/50',
    'hover:bg-brand-orange-50 hover:border-brand-orange-500',
    'active:scale-[0.98]',
    'focus:ring-2 focus:ring-brand-orange-500/50 focus:ring-offset-2',
    'rounded-xl',
  ].join(' '),

  // White: 흰 배경 + 네이비 텍스트 → 어두운 배경 위에서 사용
  white: [
    'bg-white text-brand-navy-900 border border-gray-200',
    'hover:bg-gray-50 hover:shadow-md',
    'active:scale-[0.98]',
    'focus:ring-2 focus:ring-brand-orange-500/50 focus:ring-offset-2',
    'rounded-xl',
  ].join(' '),

  // CTA Large: 큰 행동 유도 버튼 — 히어로/배너에서 사용
  cta: [
    'bg-brand-orange-500 text-white font-bold',
    'hover:bg-brand-orange-600 hover:scale-[1.03] hover:shadow-xl',
    'active:scale-[0.98]',
    'focus:ring-2 focus:ring-brand-orange-500/50 focus:ring-offset-2',
    'rounded-2xl', // CTA는 더 둥글게
  ].join(' '),
};

// 각 size별 패딩/폰트 크기 매핑
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

// CTA는 자체 크기 스타일 사용 (더 크고 넉넉한 패딩)
const ctaSizeStyle = 'px-10 py-5 text-lg';

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...rest
}: ButtonProps) {
  // CTA variant는 자체 크기 스타일 적용, 나머지는 size prop 사용
  const appliedSize = variant === 'cta' ? ctaSizeStyle : sizeStyles[size];

  return (
    <button
      className={[
        // 모든 버튼에 공통 적용: 부드러운 전환 효과 + 인라인 정렬
        'inline-flex items-center justify-center',
        'transition-all duration-200',
        'cursor-pointer',
        'font-medium',
        variantStyles[variant],
        appliedSize,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
