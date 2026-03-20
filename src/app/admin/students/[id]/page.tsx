import { getStudentActivity } from "@/lib/queries";
import StudentDetailClient from "./StudentDetailClient";
import { notFound } from "next/navigation";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getStudentActivity(id);
    if (!data) notFound();
    return <StudentDetailClient data={data} />;
}
