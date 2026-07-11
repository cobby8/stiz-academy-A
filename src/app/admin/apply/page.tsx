import ApplyAdminClient from "./ApplyAdminClient";
import { getCachedAdminApplyPayload } from "@/lib/adminReadPayloads";

// 30초 캐시: Server Action 호출 시 즉시 무효화
export const revalidate = 30;

export default async function AdminApplyPage() {
    const { applications, stats, classes } = await getCachedAdminApplyPayload();

    return (
        <ApplyAdminClient
            initialApplications={applications}
            initialStats={stats}
            initialClasses={classes}
        />
    );
}
