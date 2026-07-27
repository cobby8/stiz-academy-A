// 방학특강 사전 결석 신고 — 순수 규칙(의존성 0, 테스트가 직접 import).
// SQL/DB에 의존하지 않는 "사유 검증 + 사유별 기본 처리방향" 로직만 담는다.

// 사유별 라벨(한국어)
export const REASON_LABEL: Record<string, string> = {
  ILLNESS_INJURY: "질병·부상",
  PERSONAL: "개인 사정",
  FAMILY_TRIP: "가족 여행",
  SCHOOL_EVENT: "학교 행사",
  ETC: "기타",
};

// 허용 사유 집합
export const VALID_REASONS = new Set(Object.keys(REASON_LABEL));

// 사유가 허용 집합에 속하는지
export function isValidReason(reason: unknown): reason is string {
  return typeof reason === "string" && VALID_REASONS.has(reason);
}

// 사유별 기본 처리방향(resolution).
// 질병·부상 → CARRYOVER(이월/환불 검토), 그 외 → MAKEUP(보강). 최종 확정은 관리자 몫.
export function defaultResolution(reason: string): "CARRYOVER" | "MAKEUP" {
  return reason === "ILLNESS_INJURY" ? "CARRYOVER" : "MAKEUP";
}
