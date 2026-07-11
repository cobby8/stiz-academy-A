import AnnualAdminClient from "./AnnualAdminClient";
import { getCachedAdminAnnualPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function AnnualAdminPage() {
    const { events, initialIcsUrl } = await getCachedAdminAnnualPayload();

    return <AnnualAdminClient events={events} initialIcsUrl={initialIcsUrl} />;
}
