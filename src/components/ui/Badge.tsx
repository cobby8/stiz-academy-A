/**
 * Badge — 공통 뱃지 컴포넌트 (Phase 0 디자인 시스템)
 *
 * 상태나 카테고리를 표시하는 작은 라벨.
 * 둥근 pill 모양(rounded-full)으로 표시된다.
 *
 * 5종 variant:
 * - default: 오렌지 계열 (기본 강조)
 * - success: 초록 계열 (여석 있음, 성공)
 * - warning: 노란 계열 (마감 임박)
 * - error: 빨간 계열 (마감, 에러)
 * - info: 하늘색 계열 (정보, 안내)
 *
 * Server Component 가능 (상태/이벤트 없음)
 */

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

// 각 variant별 배경색 + 텍스트색
const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-brand-orange-50 dark:bg-brand-neon-lime/10  text-brand-orange-600 dark:text-brand-neon-lime',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
  info: 'bg-brand-sky-50 text-brand-sky-500',
};

// 크기별 패딩/폰트
const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export default function Badge({
  variant = 'default',
  size = 'sm',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        // pill 모양 + 굵은 폰트 + 인라인 정렬
        'inline-flex items-center rounded-full font-medium',
        variantStyles[variant],
        sizeStyles[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
