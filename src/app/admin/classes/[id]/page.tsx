import ClassDetailClient from "./ClassDetailClient";
import { getClassWithStudents, getCoaches, getSessionsByClass } from "@/lib/queries";

// 30초 캐시: Server Action 호출 시 즉시 무효화됨
export const revalidate = 30;

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 16에서 params는 Promise — await 필요
    const { id } = await params;
    const [classData, sessions, coaches] = await Promise.all([
        getClassWithStudents(id),
        getSessionsByClass(id),
        getCoaches(),
    ]);

    return (
        <ClassDetailClient
            classId={id}
            classData={classData ?? undefined}
            sessions={sessions}
            coaches={coaches}
        />
    );
}
