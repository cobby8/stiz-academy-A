import { getStudentActivity } from "@/lib/queries";
import StudentDetailClient from "./StudentDetailClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getStudentActivity(id);
    if (!data) notFound();
    return <StudentDetailClient data={data} />;
}
