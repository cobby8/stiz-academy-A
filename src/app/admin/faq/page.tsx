import { getAllFaqs } from "@/lib/queries";
import FaqAdminClient from "./FaqAdminClient";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminFaqPage() {
    // DB에서 전체 FAQ 조회 (공개/비공개 모두)
    const faqs = await getAllFaqs();
    return <FaqAdminClient faqs={faqs} />;
}
