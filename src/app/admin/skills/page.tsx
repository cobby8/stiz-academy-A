import { getSkillCategories } from "@/lib/queries";
import { ensureSkillTables } from "@/app/actions/admin";
import SkillsClient from "./SkillsClient";

// 30초 ISR — 관리자 페이지 캐싱 정책 준수
export const revalidate = 30;

export default async function AdminSkillsPage() {
    // DDL ensure — 테이블이 없으면 자동 생성
    await ensureSkillTables();

    // Category data is enough for the first paint; student options load on demand.
    const categories = await getSkillCategories();

    return <SkillsClient categories={categories} />;
}
