import { getClassWithStudents, getSessionsByClass, getCoaches } from "@/lib/queries";
import ClassDetailClient from "./ClassDetailClient";
import { notFound } from "next/navigation";

// 30초 캐시: Server Action 호출 시 즉시 무효화됨
export const revalidate = 30;

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 16에서 params는 Promise — await 필요
    const { id } = await params;

    // 반 정보 + 수강생 + 수업 기록 + 코치 목록을 병렬로 조회
    const [classData, sessions, coaches] = await Promise.all([
        getClassWithStudents(id),
        getSessionsByClass(id),
        getCoaches(),
    ]);

    // 반이 없으면 404 페이지 표시
    if (!classData) notFound();

    return <ClassDetailClient classData={classData} sessions={sessions} coaches={coaches} />;
}
