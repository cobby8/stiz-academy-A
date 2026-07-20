export type AdminAuthFailure = {
  message: string;
  status: 401 | 403;
  code: "UNAUTHORIZED" | "FORBIDDEN";
};

export function classifyAdminAuthError(error: unknown): AdminAuthFailure | null {
  if (!(error instanceof Error)) return null;

  if (error.message.includes("인증이 필요")) {
    return { message: "로그인이 필요합니다.", status: 401, code: "UNAUTHORIZED" };
  }

  if (error.message.includes("관리자 권한")) {
    return { message: "관리자 권한이 필요합니다.", status: 403, code: "FORBIDDEN" };
  }

  return null;
}
