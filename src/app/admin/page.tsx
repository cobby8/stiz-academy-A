import AdminDashboardClient from "./AdminDashboardClient";
import { getCachedAdminDashboardPrimaryPayload } from "@/lib/adminReadPayloads";

// 30초 캐시: Server Action 호출 시 즉시 무효화됨
export const revalidate = 30;

export default async function AdminDashboard() {
    const initialData = await getCachedAdminDashboardPrimaryPayload();

    return <AdminDashboardClient initialData={initialData} hydrateFullData />;
}
