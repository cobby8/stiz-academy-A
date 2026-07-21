import StudentDetailClient from "./StudentDetailClient";
import { getStudentActivity } from "@/lib/queries";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 30;

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getStudentActivity(id);
    if (!data) notFound();

    return <>
        <div className="mx-auto mb-4 flex max-w-5xl justify-end">
            <Link href={`/admin/students/${id}/media-consent`} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                사진 사용 동의 관리
            </Link>
        </div>
        <StudentDetailClient studentId={id} data={data} />
    </>;
}
