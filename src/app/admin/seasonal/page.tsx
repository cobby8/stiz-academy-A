import SeasonalAdminClient from "./SeasonalAdminClient";
import { getSeasonalAdminOverview } from "@/lib/seasonal/admin-overview";

export const dynamic = "force-dynamic";

export default async function SeasonalAdminPage() {
  const overview = await getSeasonalAdminOverview();
  const initialData = JSON.parse(JSON.stringify(overview)) as Record<string, unknown>;

  return <SeasonalAdminClient initialData={initialData} />;
}
