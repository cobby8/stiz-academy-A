import UnifiedDriverRunPage, { isValidRunDate } from "@/components/shuttle/UnifiedDriverRunPage";

export const dynamic = "force-dynamic";

/**
 * 기사님 운행 화면(정규 셔틀 링크 진입점) — 실제 화면은 통합 화면 하나다.
 * 링크 종류와 무관하게 그날 방학특강·정규 운행이 시각순으로 함께 보인다.
 */
export default async function RegularRunPage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  // date 쿼리는 클라 입력이므로 서버에서 형식·달력 유효성을 확인한 뒤에만 쓴다.
  const searchDate = sp?.date && isValidRunDate(sp.date) ? sp.date : null;
  return <UnifiedDriverRunPage token={token} searchDate={searchDate} />;
}
