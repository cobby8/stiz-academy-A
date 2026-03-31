import { getSkillCategories, getStudents } from "@/lib/queries";
import { ensureSkillTables } from "@/app/actions/admin";
import SkillsClient from "./SkillsClient";

// 30초 ISR — 관리자 페이지 캐싱 정책 준수
export const revalidate = 30;

export default async function AdminSkillsPage() {
    // DDL ensure — 테이블이 없으면 자동 생성
    await ensureSkillTables();

    // 카테고리 목록과 원생 목록을 병렬 조회
    const [categories, students] = await Promise.all([
        getSkillCategories(),
        getStudents(),
    ]);

    return <SkillsClient categories={categories} students={students} />;
}
