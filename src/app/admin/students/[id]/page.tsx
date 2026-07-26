import StudentDetailClient from "./StudentDetailClient";
import { getStudentActivity, getClasses } from "@/lib/queries";
import { notFound } from "next/navigation";

export const revalidate = 30;

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // 학생 활동 데이터(무변경)와 반 목록(반 추가 선택지)을 병렬 조회
    // getClasses는 학생관리 목록 페이지가 쓰는 기존 쿼리를 그대로 재사용
    const [data, classes] = await Promise.all([getStudentActivity(id), getClasses()]);
    if (!data) notFound();

    // 사진 사용 동의 링크는 클라이언트 헤더 우측 액션으로 이동함
    return <StudentDetailClient studentId={id} data={data} classes={classes} />;
}
