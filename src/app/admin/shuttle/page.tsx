import ShuttleRouteAdminClient from "./ShuttleRouteAdminClient";
import { getShuttleDashboard } from "@/lib/shuttle/service";

export const dynamic = "force-dynamic";

export default async function ShuttleAdminPage() {
  const dashboard = await getShuttleDashboard();
  const initialData = JSON.parse(JSON.stringify(dashboard)) as Parameters<typeof ShuttleRouteAdminClient>[0]["initialData"];

  return <ShuttleRouteAdminClient initialData={initialData} />;
}
