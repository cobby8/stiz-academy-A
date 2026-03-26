/**
 * 메인 랜딩 페이지 — Server Component (Phase 1 개편)
 *
 * Phase 1 변경사항:
 * - 기존에 LandingPageClient가 자체 헤더/푸터를 가지고 있었으나,
 *   이제 PublicHeader + PublicFooter로 감싸는 구조로 통합
 * - settings 데이터를 서버에서 한 번만 가져와서 헤더/푸터/콘텐츠에 모두 전달
 * - revalidate: 60 유지 (캐싱 정책 변경 없음)
 */

import { getAcademySettings } from "@/lib/queries";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import LandingPageClient from "./LandingPageClient";
import ChatBotButton from "@/components/chat/ChatBotButton";
// 가이드 투어: 메인 페이지에서도 플로팅 버튼 표시
import GuideTourTrigger from "@/components/guide-tour/GuideTourTrigger";

export const revalidate = 60;

export const metadata = {
  title: "STIZ 농구교실 다산점 | 다산신도시 No.1 농구 전문 학원",
  description:
    "다산신도시 스티즈 농구교실입니다. 유아·초등·중등 수준별 맞춤 클래스, 전문 코치진, 셔틀 운행. 체험 수업 신청 및 수강 문의.",
};

export default async function Home() {
  let settings: any = null;
  try {
    settings = await getAcademySettings();
  } catch (e) {
    console.error("Failed to load settings for landing page:", e);
  }

  // 헤더/푸터에 전달할 데이터 추출
  const phone = settings?.contactPhone || "010-0000-0000";
  const address = settings?.address || "";

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* 통합 헤더 */}
      <PublicHeader phone={phone} address={address} />

      {/* 메인 콘텐츠 — LandingPageClient는 히어로~CTA까지만 담당 */}
      <main className="flex-1">
        <LandingPageClient initialSettings={settings} />
      </main>

      {/* 통합 푸터 */}
      <PublicFooter phone={phone} address={address} />

      {/* 챗봇 버튼 — 다른 페이지는 PublicPageLayout에서 렌더링하지만, 메인 페이지는 직접 추가 */}
      <ChatBotButton />

      {/* 가이드 투어: 플로팅 트리거 버튼 (driver.js가 오버레이/말풍선 직접 처리) */}
      <GuideTourTrigger />
    </div>
  );
}
