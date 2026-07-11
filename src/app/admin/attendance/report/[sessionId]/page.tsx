import ReportEditClient from "./ReportEditClient";
import { getCoaches, getSessionReport } from "@/lib/queries";

// 관리자 리포트 편집은 30초 캐시
export const revalidate = 30;

export default async function AdminReportEditPage({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}) {
    const { sessionId } = await params;
    const [report, coaches] = await Promise.all([
        getSessionReport(sessionId),
        getCoaches(),
    ]);

    return <ReportEditClient sessionId={sessionId} report={report} coaches={coaches} />;
}
