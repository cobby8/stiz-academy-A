import TrialCrmClient from "./TrialCrmClient";
import { getCachedAdminTrialPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function TrialCrmPage() {
    const { leads, stats } = await getCachedAdminTrialPayload();

    return <TrialCrmClient initialLeads={leads} initialStats={stats} />;
}
