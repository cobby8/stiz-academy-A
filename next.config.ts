import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node-ical", "rrule-temporal", "@js-temporal/polyfill"],
  images: {
    remotePatterns: [
      // Supabase Storage (코치 이미지 등 사용자 업로드 파일)
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },

  // 보안 헤더 — 클릭재킹, MIME 스니핑, 불필요 권한 차단
  async headers() {
    return [
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
