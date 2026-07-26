import ShuttleRosterClient from "./ShuttleRosterClient";
import SeasonalSectionTabs from "../SeasonalSectionTabs";
import SeasonalHeader from "../SeasonalHeader";
import { getSeasonalShuttleRoster } from "@/lib/seasonal/shuttle-roster";
import { shuttleRosterConfirmationInfo } from "@/lib/seasonal/shuttleRoster";
import { countPendingMakeups } from "@/lib/seasonal/attendance";

export const dynamic = "force-dynamic";

// 방학특강 셔틀 통합 명단(학생 단위 편집 뷰). 상단 공통 헤더·탭을 다른 방학특강 화면과 동일하게 사용한다.
export default async function SeasonalShuttleRosterPage() {
  const [roster, makeupPending, confirmation] = await Promise.all([
    getSeasonalShuttleRoster(),
    countPendingMakeups(),
    // 확정일시(배너 표기용). 명단 조회와 독립이라 같이 병렬로 읽는다.
    shuttleRosterConfirmationInfo(),
  ]);
  const initialRoster = JSON.parse(JSON.stringify(roster));

  return (
    <>
      <SeasonalHeader />
      <SeasonalSectionTabs makeupPending={makeupPending} />
      <ShuttleRosterClient
        initialRoster={initialRoster}
        initialConfirmedAt={confirmation.confirmedAt ? confirmation.confirmedAt.toISOString() : null}
        initialConfirmedCount={confirmation.count}
        initialConfirmed={confirmation.confirmed}
      />
    </>
  );
}
