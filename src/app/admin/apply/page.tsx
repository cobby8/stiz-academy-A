/**
 * 수강 신청 관리 페이지 — 서버 컴포넌트
 * - 30초 ISR 캐싱 (관리자 페이지 표준)
 * - 신청서 목록 + 통계 + 반 목록 + 설정을 병렬 조회 후 클라이언트에 전달
 */
import { getEnrollApplications, getEnrollApplicationStats, getClasses, getAcademySettings } from "@/lib/queries";
import { ensureEnrollmentApplicationTable } from "@/app/actions/public";
import ApplyAdminClient from "./ApplyAdminClient";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminApplyPage() {
    // DDL ensure — 테이블이 없으면 자동 생성
    await ensureEnrollmentApplicationTable();

    // 초기 데이터 병렬 조회
    const [applications, stats, classes, settings] = await Promise.all([
        getEnrollApplications(),
        getEnrollApplicationStats(),
        getClasses(),
        getAcademySettings().catch(() => ({} as any)),
    ]);

    return (
        <ApplyAdminClient
            initialApplications={applications}
            initialStats={stats}
            initialClasses={classes}
            initialSettings={{
                trialTitle: settings?.trialTitle || "체험수업 안내",
                trialContent: settings?.trialContent || null,
                trialFormUrl: settings?.trialFormUrl || null,
                enrollTitle: settings?.enrollTitle || "수강신청 안내",
                enrollContent: settings?.enrollContent || null,
                enrollFormUrl: settings?.enrollFormUrl || null,
                uniformFormUrl: settings?.uniformFormUrl || null,
            }}
        />
    );
}
