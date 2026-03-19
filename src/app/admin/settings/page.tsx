import { getAcademySettings } from "@/lib/queries";
import { ensureAcademySettingsColumns } from "@/app/actions/admin";
import AdminSettingsClient from "./AdminSettingsClient";

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
