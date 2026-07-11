import ReportListClient from "./ReportListClient";
import { getCachedAdminReportListPayload } from "@/lib/adminReadPayloads";

// 관리자 리포트 목록은 30초 캐시 (출결 기록 후 자동 갱신)
export const revalidate = 30;

export default async function AdminReportListPage() {
    const { sessions } = await getCachedAdminReportListPayload(50);

    return <ReportListClient sessions={sessions} />;
}
