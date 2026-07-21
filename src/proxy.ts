import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // /admin 하위 모든 경로 보호
    "/admin/:path*",
    "/staff/:path*",
    // /login 경로 (이미 로그인 시 리다이렉트)
    "/login",
    // /mypage 하위 모든 경로 보호 (향후 학부모 기능용)
    "/mypage/:path*",
    // 결제 페이지도 세션 갱신 대상에 포함합니다. 실제 미인증 이동은 결제 페이지가 원래 주소를 보존해 처리합니다.
    "/payments/:path*",
  ],
};
