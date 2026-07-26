import ShuttleRosterClient from "./ShuttleRosterClient";
import SeasonalSectionTabs from "../SeasonalSectionTabs";
import SeasonalHeader from "../SeasonalHeader";
import { getSeasonalShuttleRoster } from "@/lib/seasonal/shuttle-roster";
import { countPendingMakeups } from "@/lib/seasonal/attendance";

export const dynamic = "force-dynamic";

// 방학특강 셔틀 통합 명단(학생 단위 편집 뷰). 상단 공통 헤더·탭을 다른 방학특강 화면과 동일하게 사용한다.
export default async function SeasonalShuttleRosterPage() {
  const [roster, makeupPending] = await Promise.all([
    getSeasonalShuttleRoster(),
    countPendingMakeups(),
  ]);
  const initialRoster = JSON.parse(JSON.stringify(roster));

  return (
    <>
      <SeasonalHeader />
      <SeasonalSectionTabs makeupPending={makeupPending} />
      <ShuttleRosterClient initialRoster={initialRoster} />
    </>
  );
}
