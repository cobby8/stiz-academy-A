import { getAcademySettings } from "@/lib/queries";
import TermsAdminClient from "./TermsAdminClient";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminTermsPage() {
    let termsOfService: string | null = null;
    try {
        const settings = await getAcademySettings();
        termsOfService = (settings as any)?.termsOfService ?? null;
    } catch (e) {
        console.error("Error fetching terms:", e);
    }
    return <TermsAdminClient termsOfService={termsOfService} />;
}
