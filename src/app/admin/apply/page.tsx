import ApplyAdminClient from "./ApplyAdminClient";
import {
    getCachedAdminApplyPayload,
    getCachedAdminTrialPayload,
} from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AdminApplyPage() {
    const [applyPayload, trialPayload] = await Promise.all([
        getCachedAdminApplyPayload(),
        getCachedAdminTrialPayload(),
    ]);

    return (
        <ApplyAdminClient
            initialApplications={applyPayload.applications}
            initialStats={applyPayload.stats}
            initialClasses={applyPayload.classes}
            initialTrialLeads={trialPayload.leads}
            initialTrialStats={trialPayload.stats}
        />
    );
}
