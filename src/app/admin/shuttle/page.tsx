import ShuttleRouteAdminClient from "./ShuttleRouteAdminClient";
import SeasonalSectionTabs from "../seasonal/SeasonalSectionTabs";
import { getShuttleDashboard } from "@/lib/shuttle/service";
import { countPendingMakeups } from "@/lib/seasonal/attendance";

export const dynamic = "force-dynamic";

export default async function ShuttleAdminPage() {
  // 셔틀 화면에서도 같은 상단 탭을 쓰므로 보강 대기 뱃지를 동일하게 표시한다(병렬 조회).
  const [dashboard, makeupPending] = await Promise.all([
    getShuttleDashboard(),
    countPendingMakeups(),
  ]);
  const initialData = JSON.parse(JSON.stringify(dashboard)) as Parameters<typeof ShuttleRouteAdminClient>[0]["initialData"];

  return (
    <>
      <SeasonalSectionTabs makeupPending={makeupPending} />
      <ShuttleRouteAdminClient initialData={initialData} />
    </>
  );
}
