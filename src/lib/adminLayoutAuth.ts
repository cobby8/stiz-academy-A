export type AdminLayoutAuthFailure = "LOGIN_REQUIRED" | "FORBIDDEN";

/**
 * 관리자 레이아웃에서 인증·권한 오류만 분리합니다.
 * DB 연결 실패처럼 예상하지 못한 오류는 null로 남겨 오류 화면에서 복구하게 합니다.
 */
export function classifyAdminLayoutAuthFailure(error: unknown): AdminLayoutAuthFailure | null {
  if (!(error instanceof Error)) return null;
  if (error.message.includes("인증이 필요")) return "LOGIN_REQUIRED";
  if (error.message.includes("관리자 권한")) return "FORBIDDEN";
  return null;
}
