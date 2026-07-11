import StatsClient from "./StatsClient";
import { getCachedAdminStatsPayload } from "@/lib/adminReadPayloads";

// 30초 캐시: Server Action 호출 시 즉시 무효화됨
export const revalidate = 30;

export default async function StatsPage() {
    const stats = await getCachedAdminStatsPayload();

    return <StatsClient {...stats} />;
}
