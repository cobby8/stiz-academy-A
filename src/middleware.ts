/**
 * Next.js 미들웨어 — /admin 경로 인증 보호
 *
 * src/lib/supabase/middleware.ts의 updateSession 함수를 활용하여
 * /admin/* 경로에 접근하는 사용자의 인증 상태를 확인한다.
 * 인증되지 않은 사용자는 /login으로 리다이렉트된다.
 *
 * 이미 각 API 라우트에서 개별 인증 체크를 하고 있으므로,
 * 이 미들웨어는 추가 보안 레이어 역할을 한다.
 */

import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    // Supabase 세션 갱신 + /admin 인증 체크 + /login 리다이렉트 처리
    return await updateSession(request);
}

// 미들웨어가 실행될 경로를 지정 (matcher)
// /admin 하위 전체 + /login 페이지에만 적용
// 제외 대상: 정적 파일(_next/static), 이미지(_next/image), favicon, API cron
export const config = {
    matcher: [
        "/admin/:path*",
        "/login",
    ],
};
