import { getSkillCategories } from "@/lib/queries";
import SkillsClient from "./SkillsClient";

// 30초 ISR — 관리자 페이지 캐싱 정책 준수
export const revalidate = 30;

export default async function AdminSkillsPage() {
    // 스킬 생성/수정/평가 저장 액션에서 테이블을 보장하므로, 화면은 카테고리만 빠르게 조회한다.
    const categories = await getSkillCategories();

    return <SkillsClient categories={categories} />;
}
