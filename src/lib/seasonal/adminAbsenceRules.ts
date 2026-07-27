// 방학특강 결석 신고 "관리자 처리" — 순수 규칙(의존성 0, 테스트가 직접 import).
// SQL/DB에 의존하지 않는 "처리방식 검증 + 회차 금액 계산 + 확정 가능 판정"만 담는다.

// 처리방식(resolution) 라벨(한국어)
export const RESOLUTION_LABEL: Record<string, string> = {
  PENDING: "미정",
  MAKEUP: "보강",
  CARRYOVER: "이월",
  REFUND: "환불",
};

// 신고 상태(status) 라벨(한국어)
export const ABSENCE_STATUS_LABEL: Record<string, string> = {
  REPORTED: "신고됨",
  CONFIRMED: "확정",
  CANCELLED: "취소됨",
};

// 관리자가 협의로 "지정"할 수 있는 처리방식 집합.
// PENDING(미정)은 학부모 신고 직후의 기본값일 뿐, 관리자가 일부러 되돌리는 값이 아니므로 제외한다.
export const ASSIGNABLE_RESOLUTIONS = new Set(["MAKEUP", "CARRYOVER", "REFUND"]);

// 관리자가 지정하려는 처리방식이 허용 집합에 속하는지
export function isAssignableResolution(resolution: unknown): resolution is string {
  return typeof resolution === "string" && ASSIGNABLE_RESOLUTIONS.has(resolution);
}

// 확정(REPORTED → CONFIRMED) 가능 여부.
// - 이미 처리방식이 정해져 있어야(=PENDING 이 아니어야) 확정할 수 있다.
//   (먼저 보강/이월/환불 중 하나를 지정하라는 뜻)
export function canConfirm(resolution: string | null | undefined): boolean {
  return !!resolution && resolution !== "PENDING";
}

// 회차 금액(표시용) = 항목 결제금액(priceSnapshot) ÷ 그 항목 전체 회차수.
// - 이월/환불 협의 시 "이 한 회차가 얼마짜리인지" 관리자가 가늠하기 위한 참고값이다.
// - 회차수가 0 이하이거나 금액이 없으면 계산할 수 없으므로 null 을 돌려준다.
// - 원 단위 반올림(소수점 금액은 실제로 존재하지 않으므로).
export function perSessionAmount(
  priceSnapshot: number | null | undefined,
  roundCount: number | null | undefined,
): number | null {
  // Number(null) === 0 이므로, null/undefined 는 "값 없음"으로 먼저 걸러낸다.
  if (priceSnapshot == null || roundCount == null) return null;
  const price = Number(priceSnapshot);
  const rounds = Number(roundCount);
  if (!Number.isFinite(price) || price < 0) return null;
  if (!Number.isFinite(rounds) || rounds <= 0) return null;
  return Math.round(price / rounds);
}
