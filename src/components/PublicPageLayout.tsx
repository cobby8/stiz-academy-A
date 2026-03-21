/**
 * PublicPageLayout — 서브페이지 공통 래퍼 (Phase 1 개편)
 *
 * 8개 서브페이지(about, programs, schedule, annual, gallery, notices, apply, mypage)가
 * 이 컴포넌트를 import하여 감싸는 구조.
 *
 * Phase 1 변경사항:
 * - 기존에 이 파일 안에 직접 작성되어 있던 헤더/푸터 코드를 제거
 * - PublicHeader(Client Component) + PublicFooter(Server Component)로 교체
 * - Server Component 유지 — settings를 서버에서 가져와서 자식 컴포넌트에 props로 전달
 *
 * 기존 서브페이지에서 <PublicPageLayout>{children}</PublicPageLayout> 형태로
 * 사용하는 방식은 그대로 유지되므로, 서브페이지 코드 수정 불필요.
 */

import { getAcademySettings } from "@/lib/queries";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";
import ChatBotButton from "./chat/ChatBotButton";

export default async function PublicPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 서버에서 학원 설정 데이터를 가져온다 (전화번호, 주소 등)
  const settings = await getAcademySettings();
  const phone = (settings as any).contactPhone || "010-0000-0000";
  const address = (settings as any).address || "";

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* 통합 헤더 — Client Component (모바일 햄버거 메뉴 때문) */}
      <PublicHeader phone={phone} address={address} />

      {/* 페이지 콘텐츠 영역 — 서브페이지의 children이 여기에 들어감 */}
      <main className="flex-1">{children}</main>

      {/* 통합 푸터 — Server Component */}
      <PublicFooter phone={phone} address={address} />

      {/* 학부모 상담 챗봇 — 모든 공개 페이지 우하단에 플로팅 버튼 */}
      <ChatBotButton />
    </div>
  );
}
