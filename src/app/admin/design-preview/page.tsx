import DesignPreviewClient from "./DesignPreviewClient";

export const dynamic = "force-dynamic";

// 학적부(문서형) 디자인 토큰 미리보기 — 2026-08 관리자 개편.
//
// 이 페이지는 **기존 화면을 하나도 건드리지 않는다.** 토큰과 공통 컴포넌트가 실제로
// 어떻게 보이는지 눈으로 확인하고 합의하기 위한 곳이다. 합의가 끝나면 실제 화면에
// 옮기고, 이 페이지는 남겨 두어 이후 규칙의 기준으로 쓴다.
export default function DesignPreviewPage() {
  return <DesignPreviewClient />;
}
