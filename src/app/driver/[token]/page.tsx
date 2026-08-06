import UnifiedDriverRunPage, { isValidRunDate } from "@/components/shuttle/UnifiedDriverRunPage";

export const dynamic = "force-dynamic";

/**
 * 기사님 전용 통합 URL: /driver/[token]
 * 방학특강 토큰이든 정규 토큰이든 같은 통합 운행 화면을 연다.
 * 기사님께는 링크 하나만 공유하면 그날 운행이 전부 시각순으로 보인다.
 */
export default async function DriverUnifiedPage({
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
