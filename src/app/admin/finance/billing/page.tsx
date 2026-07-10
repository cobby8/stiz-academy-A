import BillingTemplateClient from "./BillingTemplateClient";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default function BillingTemplatePage() {
    return <BillingTemplateClient />;
}
