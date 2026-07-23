import ApplyAdminClient from "./ApplyAdminClient";
import { getCachedAdminTrialPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminApplyPage() {
    const trialPayload = await getCachedAdminTrialPayload({ limit: 50, offset: 0 });

    return (
        <ApplyAdminClient
            initialTrialLeads={trialPayload.leads}
            initialTrialStats={trialPayload.stats}
            initialTrialClasses={trialPayload.classes}
            initialTrialPagination={trialPayload.pagination}
        />
    );
}
