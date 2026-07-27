import RegularDispatchClient from "./RegularDispatchClient";
import ShuttleSectionTabs from "../ShuttleSectionTabs";
import SeasonalHeader from "../../seasonal/SeasonalHeader";
import { getRegularShuttleWeekdays } from "@/lib/regular/shuttleRoster";
import { getRegularDispatchForView } from "@/lib/regular/regularDispatchRoute";

export const dynamic = "force-dynamic";

// 정규 셔틀 동적배차(신청서 좌표 기반) — 방학특강 배차 화면을 요일 기준으로 재사용한다.
// 구글시트 정규 셔틀(/admin/shuttle/regular)과는 별개의 새 화면(정합 명단 소스).
export default async function RegularDispatchPage() {
  const weekdays = await getRegularShuttleWeekdays();
  const initialDay = weekdays[0] ?? "Mon";

  // 저장본이 있으면 T맵 없이 그대로(제공량 절약). 없을 때만 T맵으로 초안 계산.
  const [pickup, dropoff] = await Promise.all([
    getRegularDispatchForView(initialDay, "PICKUP", true),
    getRegularDispatchForView(initialDay, "DROPOFF", true),
  ]);
  const initialPickup = JSON.parse(JSON.stringify(pickup));
  const initialDropoff = JSON.parse(JSON.stringify(dropoff));

  return (
    <>
      <SeasonalHeader eyebrow="SHUTTLE" title="셔틀 관리" subtitle="정규 수업 셔틀을 요일별로 자동 배차합니다(학생 신청서 좌표 기반)." />
      <ShuttleSectionTabs />
      <RegularDispatchClient
        weekdays={weekdays}
        initialDay={initialDay}
        initialPickup={initialPickup}
        initialDropoff={initialDropoff}
      />
    </>
  );
}
