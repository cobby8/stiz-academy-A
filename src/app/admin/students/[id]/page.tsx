import StudentDetailClient from "./StudentDetailClient";

export const revalidate = 30;

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return <StudentDetailClient studentId={id} />;
}
