import StudentDetailClient from "./StudentDetailClient";
import { getStudentActivity } from "@/lib/queries";

export const revalidate = 30;

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getStudentActivity(id);

    return <StudentDetailClient studentId={id} data={data ?? undefined} />;
}
