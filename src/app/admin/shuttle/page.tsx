import ShuttleRouteAdminClient from "./ShuttleRouteAdminClient";
import SeasonalSectionTabs from "../seasonal/SeasonalSectionTabs";
import { getShuttleDashboard } from "@/lib/shuttle/service";

export const dynamic = "force-dynamic";

export default async function ShuttleAdminPage() {
  const dashboard = await getShuttleDashboard();
  const initialData = JSON.parse(JSON.stringify(dashboard)) as Parameters<typeof ShuttleRouteAdminClient>[0]["initialData"];

  return (
    <>
      <SeasonalSectionTabs />
      <ShuttleRouteAdminClient initialData={initialData} />
    </>
  );
}
