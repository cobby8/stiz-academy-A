/**
 * 수강생 데이터 이관 페이지 — 서버 컴포넌트
 *
 * 구글 스프레드시트의 수강생 CSV 데이터를 DB로 이관한다.
 * 서버에서는 특별한 데이터 로딩이 필요 없고,
 * 모든 로직은 클라이언트(ImportClient)에서 API를 호출한다.
 */

import ImportClient from "./ImportClient";

// ISR 30초 — 관리자 페이지 공통 설정
export const revalidate = 30;

export default function ImportPage() {
  return <ImportClient />;
}
