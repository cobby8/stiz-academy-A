import DispatchClient from "./DispatchClient";
import SeasonalSectionTabs from "../SeasonalSectionTabs";
import SeasonalHeader from "../SeasonalHeader";
import { suggestDispatch } from "@/lib/seasonal/shuttle-optimize";
import { countPendingMakeups } from "@/lib/seasonal/attendance";

export const dynamic = "force-dynamic";

// 방학특강 셔틀 자동 배차(노선 자동 제안). 기본값은 등원/첫 수업시간대/9인승으로 초안을 미리 계산해 보여준다.
export default async function SeasonalDispatchPage() {
  const [initial, makeupPending] = await Promise.all([
    suggestDispatch({ direction: "PICKUP" }),
    countPendingMakeups(),
  ]);
  const initialData = JSON.parse(JSON.stringify(initial));

  return (
    <>
      <SeasonalHeader />
      <SeasonalSectionTabs makeupPending={makeupPending} />
      <DispatchClient initial={initialData} />
    </>
  );
}
