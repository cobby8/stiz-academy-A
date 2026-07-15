import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node-ical", "rrule-temporal", "@js-temporal/polyfill"],
  images: {
    remotePatterns: [
      // Supabase Storage (코치 이미지 등 사용자 업로드 파일)
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      // Instagram/Facebook CDN (인스타그램에서 가져온 갤러리 이미지)
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
    ],
  },

  async rewrites() {
    return [
      {
        // 선생님에게 공유하는 주소는 기억하기 쉬운 /staff/install로 유지한다.
        source: "/staff/install",
        destination: "/teacher-app",
      },
      {
        // 설치 앱 주소는 /staff 범위에 유지하면서 공용 로그인 화면을 재사용한다.
        source: "/staff/login",
        destination: "/login?mode=staff",
      },
    ];
  },

  // 보안 헤더 — 클릭재킹, MIME 스니핑, 불필요 권한 차단
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/manifest-staff.json",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        // rewrite의 내부 구현 주소로 직접 접근해도 같은 공개·최소권한 정책을 적용한다.
        source: "/teacher-app",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/staff/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
      {
        // 일반 staff 권한 규칙 뒤에서 설치 화면의 카메라·마이크 권한을 다시 최소화한다.
        source: "/staff/install",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/api/staff/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
      {
        // 브라우저는 중복 권한 헤더를 교집합으로 적용하므로 교사용 경로와 겹치지 않게 한다.
        source: "/((?!staff(?:/|$)|api/staff(?:/|$)).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // 클릭재킹 방지: iframe 삽입 차단
          { key: "X-Content-Type-Options", value: "nosniff" }, // MIME 스니핑 방지
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // 리퍼러 정보 제한
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }, // 불필요한 브라우저 권한 차단
        ],
      },
    ];
  },
};

export default nextConfig;
