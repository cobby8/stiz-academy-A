import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // /admin 하위 모든 경로 보호
    "/admin/:path*",
    // /login 경로 (이미 로그인 시 리다이렉트)
    "/login",
    // /mypage 하위 모든 경로 보호 (향후 학부모 기능용)
    "/mypage/:path*",
  ],
};
