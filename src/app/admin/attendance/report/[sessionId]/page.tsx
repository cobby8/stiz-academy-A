import { getSessionReport, getCoaches } from "@/lib/queries";
import { notFound } from "next/navigation";
import ReportEditClient from "./ReportEditClient";

// 관리자 리포트 편집은 30초 캐시
export const revalidate = 30;

export default async function AdminReportEditPage({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}) {
    const { sessionId } = await params;
    // 세션 리포트 상세 + 코치 목록을 병렬 조회
    const [report, coaches] = await Promise.all([
        getSessionReport(sessionId),
        getCoaches(),
    ]);

    // 세션이 없으면 404
    if (!report) notFound();

    return <ReportEditClient report={report} coaches={coaches} />;
}
