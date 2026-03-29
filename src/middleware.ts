import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

// Next.js 미들웨어: 모든 보호 경로에서 Supabase 세션을 갱신하고,
// 미인증 사용자를 /login으로 리다이렉트한다.
// 실제 인증/리다이렉트 로직은 updateSession() 내부에 구현되어 있다.
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// matcher: 미들웨어가 실행될 경로 패턴
// - /admin/*: 관리자 페이지 전체 보호
// - /login: 이미 로그인된 사용자 → /admin 리다이렉트 처리
// - /mypage/*: 마이페이지 보호 (향후 학부모 기능용)
export const config = {
  matcher: ["/admin/:path*", "/login", "/mypage/:path*"],
};
