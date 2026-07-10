import ReportListClient from "./ReportListClient";

// 관리자 리포트 목록은 30초 캐시 (출결 기록 후 자동 갱신)
export const revalidate = 30;

export default function AdminReportListPage() {
    return <ReportListClient />;
}
