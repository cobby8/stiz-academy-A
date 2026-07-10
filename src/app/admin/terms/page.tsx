import TermsAdminClient from "./TermsAdminClient";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default function AdminTermsPage() {
    return <TermsAdminClient />;
}
