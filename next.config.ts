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
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/(.*)", // 모든 경로에 적용
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
