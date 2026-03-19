import { getAnnualEvents } from "@/lib/queries";
import AnnualAdminClient from "./AnnualAdminClient";

export const dynamic = "force-dynamic";

export default async function AnnualAdminPage() {
    const events = await getAnnualEvents();
    return <AnnualAdminClient events={events} />;
}
