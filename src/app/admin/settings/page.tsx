import { getAcademySettings } from "@/lib/queries";
import AdminSettingsClient from "./AdminSettingsClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminSettingsPage() {
    let settings = null;
    let fetchError = false;

    try {
        // 설정 저장 로직에서 누락 컬럼을 필요한 순간 보장하므로, 화면 진입은 조회만 빠르게 수행한다.
        settings = await getAcademySettings();
    } catch (e) {
        console.error("Error fetching settings:", e);
        fetchError = true;
    }

    return <AdminSettingsClient initialSettings={settings} fetchError={fetchError} />;
}
