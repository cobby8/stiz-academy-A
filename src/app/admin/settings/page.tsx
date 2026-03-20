import { getAcademySettings } from "@/lib/queries";
import { ensureAcademySettingsColumns } from "@/app/actions/admin";
import AdminSettingsClient from "./AdminSettingsClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminSettingsPage() {
    let settings = null;
    let fetchError = false;

    // 누락 컬럼 보장 (youtubeUrl 등 신규 컬럼이 DB에 없을 경우 자동 추가)
    await ensureAcademySettingsColumns().catch(() => {});

    try {
        settings = await getAcademySettings();
    } catch (e) {
        console.error("Error fetching settings:", e);
        fetchError = true;
    }

    return <AdminSettingsClient initialSettings={settings} fetchError={fetchError} />;
}
