import { getAcademySettings } from "@/lib/queries";
import { ensureAcademySettingsColumns } from "@/app/actions/admin";
import AdminSettingsClient from "./AdminSettingsClient";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminSettingsPage() {
    let settings = null;
    let fetchError = false;

    // 누락 컬럼 보장과 설정 조회를 병렬 실행 (직렬 → 병렬 최적화)
    // ensureAcademySettingsColumns가 컬럼을 추가해도 getAcademySettings는
    // 기존 컬럼만 읽으므로 동시 실행해도 안전함
    try {
        const [, fetchedSettings] = await Promise.all([
            ensureAcademySettingsColumns().catch(() => {}),
            getAcademySettings(),
        ]);
        settings = fetchedSettings;
    } catch (e) {
        console.error("Error fetching settings:", e);
        fetchError = true;
    }

    return <AdminSettingsClient initialSettings={settings} fetchError={fetchError} />;
}
