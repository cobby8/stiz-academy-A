import VehicleManagerClient from "./VehicleManagerClient";
import ShuttleSectionTabs from "./ShuttleSectionTabs";
import SeasonalHeader from "../seasonal/SeasonalHeader";
import { getShuttleDashboard } from "@/lib/shuttle/service";

export const dynamic = "force-dynamic";

// 셔틀 '차량 관리' — 노선 편성은 「자동 배차」로 대체되어, 이 화면은 차량 등록·관리만 담당한다.
// (옛 노선 편성 화면 ShuttleRouteAdminClient는 파일로 남겨 두되 렌더하지 않는다.)
export default async function ShuttleAdminPage() {
  const dashboard = await getShuttleDashboard();
  const data = JSON.parse(JSON.stringify(dashboard)) as { vehicles?: { id: string; name: string; plateNumber?: string | null; capacity: number; notes?: string | null; isActive?: boolean }[] };

  return (
    <>
      <SeasonalHeader />
      <ShuttleSectionTabs />
      <VehicleManagerClient initialVehicles={data.vehicles ?? []} />
    </>
  );
}
