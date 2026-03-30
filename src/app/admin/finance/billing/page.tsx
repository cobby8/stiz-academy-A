import { getBillingTemplates, getPrograms } from "@/lib/queries";
import BillingTemplateClient from "./BillingTemplateClient";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function BillingTemplatePage() {
    // 청구 템플릿 목록과 프로그램 목록을 동시에 조회
    const [templates, programs] = await Promise.all([
        getBillingTemplates(),
        getPrograms(),
    ]);
    return (
        <BillingTemplateClient
            initialTemplates={templates}
            programs={programs}
        />
    );
}
