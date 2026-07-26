import { getDispatchForView } from "@/lib/seasonal/shuttle-optimize";
import { resolveRunToken, getBoardingMap, type BoardingStatus } from "@/lib/seasonal/shuttleRun";
import DriverRunClient, { type DriverSection } from "@/components/seasonal/DriverRunClient";

export const dynamic = "force-dynamic";

const PREFIX = /^(STIZ 다산점 · |차고지 · )/;

// 기사님 전용 운행 화면 — 로그인 없이 토큰으로 접근. 그 날 등원 → 하원 타임라인을 함께 보여준다.
export default async function ShuttleRunPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const run = await resolveRunToken(token);
  if (!run) {
    return (
      <div className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-6 text-center">
        <div>
          <p className="text-4xl">🚌</p>
          <h1 className="mt-3 text-lg font-black text-gray-900 dark:text-white">유효하지 않은 링크입니다</h1>
          <p className="mt-1 text-sm text-gray-500">원장님께 새 링크를 요청해주세요.</p>
        </div>
      </div>
    );
  }

  const directions: ("PICKUP" | "DROPOFF")[] = ["PICKUP", "DROPOFF"];
  const sections: DriverSection[] = await Promise.all(directions.map(async (d) => {
    // 기사님 화면은 T맵을 절대 부르지 않는다(allowTmap=false) — 저장본 또는 직선 추정.
    const sug = await getDispatchForView(run.date, d, false);
    const vraw = sug.vehicles as DispatchVehicleLike[];
    const isPickup = d === "PICKUP";
    return {
      direction: d,
      time: (isPickup ? sug.classStart : sug.classEnd) ?? null,
      startName: (isPickup ? (sug.depot?.name ?? "차고지") : sug.academy.name).replace(PREFIX, ""),
      endName: (isPickup ? sug.academy.name : (sug.depot?.name ?? "차고지")).replace(PREFIX, ""),
      vehicles: vraw.map((v) => ({
        vehicleName: v.vehicleName, tripLabel: v.tripLabel ?? null,
        departTime: v.departTime ?? null, arriveTime: v.arriveTime ?? null, depotTime: v.depotTime ?? null,
        stops: (v.stops ?? []).map((s) => ({
          label: s.label, isHub: Boolean(s.isHub), etaLabel: s.etaLabel ?? null,
          students: (s.students ?? []).map((st) => ({ requestId: st.requestId, name: st.name, grade: st.grade ?? null, parentPhone: st.parentPhone ?? null, childPhone: st.childPhone ?? null })),
        })),
      })),
    };
  }));

  const [pickupBoarding, dropoffBoarding] = await Promise.all([getBoardingMap(run.date, "PICKUP"), getBoardingMap(run.date, "DROPOFF")]);

  return (
    <DriverRunClient
      token={token}
      date={run.date}
      sections={sections}
      initialBoarding={{ PICKUP: pickupBoarding, DROPOFF: dropoffBoarding } as { PICKUP: Record<string, BoardingStatus>; DROPOFF: Record<string, BoardingStatus> }}
    />
  );
}

type DispatchVehicleLike = {
  vehicleName: string; tripLabel?: string | null;
  departTime?: string | null; arriveTime?: string | null; depotTime?: string | null;
  stops?: { label: string; isHub?: boolean; etaLabel?: string | null; students?: { requestId: string; name: string; grade?: string | null; parentPhone?: string | null; childPhone?: string | null }[] }[];
};
