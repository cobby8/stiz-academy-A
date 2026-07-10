/**
 * 체험수업 CRM 관리자 페이지 — 서버 컴포넌트
 * - 30초 ISR로 캐싱 (관리자 페이지 표준)
 * - getTrialLeads()와 getTrialStats()로 초기 데이터 조회 후 클라이언트에 전달
 */
import { getTrialLeads, getTrialStats } from "@/lib/queries";
import TrialCrmClient from "./TrialCrmClient";

export const revalidate = 30;

export default async function TrialCrmPage() {
    // 화면 읽기 단계에서는 DB 구조 확인을 생략하고, 등록/수정 같은 쓰기 작업에서만 보장한다.
    const [leads, stats] = await Promise.all([
        getTrialLeads(),
        getTrialStats(),
    ]);

    return <TrialCrmClient initialLeads={leads} initialStats={stats} />;
}
