import ApplyAdminClient from "./ApplyAdminClient";
import {
    getCachedAdminApplySummaryPayload,
    getCachedAdminTrialPayload,
} from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminApplyPage() {
    const [applySummary, trialPayload] = await Promise.all([
        getCachedAdminApplySummaryPayload(),
        getCachedAdminTrialPayload({ limit: 50, offset: 0 }),
    ]);

    return (
        <ApplyAdminClient
            initialStats={applySummary.stats}
            initialTrialLeads={trialPayload.leads}
            initialTrialStats={trialPayload.stats}
            initialTrialPagination={trialPayload.pagination}
        />
    );
}
