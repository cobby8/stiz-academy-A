/**
 * 체험수업 CRM 관리자 페이지 — 서버 컴포넌트
 * - 30초 ISR로 캐싱 (관리자 페이지 표준)
 * - getTrialLeads()와 getTrialStats()로 초기 데이터 조회 후 클라이언트에 전달
 */
import { getTrialLeads, getTrialStats } from "@/lib/queries";
import { ensureTrialLeadTable } from "@/app/actions/admin";
import TrialCrmClient from "./TrialCrmClient";

export const revalidate = 30;

export default async function TrialCrmPage() {
    // DDL ensure — 테이블이 없으면 자동 생성
    await ensureTrialLeadTable();

    // 초기 데이터 조회 (전체 리드 + 통계)
    const [leads, stats] = await Promise.all([
        getTrialLeads(),
        getTrialStats(),
    ]);

    return <TrialCrmClient initialLeads={leads} initialStats={stats} />;
}
