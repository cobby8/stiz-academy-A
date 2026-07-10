import ReportEditClient from "./ReportEditClient";

// 관리자 리포트 편집은 30초 캐시
export const revalidate = 30;

export default async function AdminReportEditPage({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}) {
    const { sessionId } = await params;

    return <ReportEditClient sessionId={sessionId} />;
}
