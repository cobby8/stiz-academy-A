import AdminSettingsClient from "./AdminSettingsClient";
import { getCachedAdminSettingsPayload } from "@/lib/adminReadPayloads";

// 30초 캐시: 아무도 수정 안 할 때 캐시 유지, Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminSettingsPage() {
    const { settings, fetchError } = await getCachedAdminSettingsPayload();

    return <AdminSettingsClient initialSettings={settings} fetchError={fetchError} />;
}
