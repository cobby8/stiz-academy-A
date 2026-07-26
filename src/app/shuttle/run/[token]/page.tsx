import { computeDispatch, getDispatchForView } from "@/lib/seasonal/shuttle-optimize";
import { resolveRunToken, getBoardingMap, type BoardingStatus } from "@/lib/seasonal/shuttleRun";
import DriverRunClient, { type DriverSection } from "@/components/seasonal/DriverRunClient";

export const dynamic = "force-dynamic";

const PREFIX = /^(STIZ 다산점 · |차고지 · )/;

function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function lightError(title: string, sub: string) {
  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ colorScheme: "light" }}>
      <div className="mx-auto grid min-h-[80dvh] max-w-md place-items-center px-6 text-center">
        <div>
          <p className="text-5xl">🚌</p>
          <h1 className="mt-3 text-xl font-black text-gray-900">{title}</h1>
          <p className="mt-1 text-base text-gray-500">{sub}</p>
        </div>
      </div>
    </div>
  );
}

// 기사님 전용 운행 화면 — 로그인 없이 토큰으로 접근. 그 날(또는 고정 링크면 '오늘') 등원 → 하원 타임라인.
export default async function ShuttleRunPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const run = await resolveRunToken(token);
  if (!run) return lightError("유효하지 않은 링크입니다", "원장님께 새 링크를 요청해주세요.");

  // 고정(rolling) 링크는 '오늘' 운행을 본다. 오늘이 운행일이 아니면 가장 가까운 다음 운행일.
  let effectiveDate: string | null = run.date === "ROLLING" ? null : run.date;
  if (run.date === "ROLLING") {
    const probe = await computeDispatch({ direction: "PICKUP", date: null, localOnly: true });
    const dates = probe.availableDates.map((d) => d.date).sort();
    const today = todayKST();
    effectiveDate = dates.includes(today) ? today : (dates.filter((d) => d >= today)[0] ?? dates[dates.length - 1] ?? null);
  }
  if (!effectiveDate) return lightError("오늘은 운행이 없습니다", "다음 운행일에 다시 열어주세요.");

  const directions: ("PICKUP" | "DROPOFF")[] = ["PICKUP", "DROPOFF"];
  const sections: DriverSection[] = await Promise.all(directions.map(async (d) => {
    const sug = await getDispatchForView(effectiveDate, d, false); // 기사님 화면은 T맵 미호출(저장본/직선)
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
          lat: typeof s.lat === "number" ? s.lat : null, lng: typeof s.lng === "number" ? s.lng : null,
          students: (s.students ?? []).map((st) => ({ requestId: st.requestId, name: st.name, grade: st.grade ?? null, parentPhone: st.parentPhone ?? null, childPhone: st.childPhone ?? null })),
        })),
      })),
    };
  }));

  const [pickupBoarding, dropoffBoarding] = await Promise.all([getBoardingMap(effectiveDate, "PICKUP"), getBoardingMap(effectiveDate, "DROPOFF")]);

  return (
    <div className="min-h-screen bg-white py-2" style={{ colorScheme: "light" }}>
      <DriverRunClient
        token={token}
        date={effectiveDate}
        sections={sections}
        initialBoarding={{ PICKUP: pickupBoarding, DROPOFF: dropoffBoarding } as { PICKUP: Record<string, BoardingStatus>; DROPOFF: Record<string, BoardingStatus> }}
      />
    </div>
  );
}

type DispatchVehicleLike = {
  vehicleName: string; tripLabel?: string | null;
  departTime?: string | null; arriveTime?: string | null; depotTime?: string | null;
  stops?: { label: string; isHub?: boolean; etaLabel?: string | null; lat?: number; lng?: number; students?: { requestId: string; name: string; grade?: string | null; parentPhone?: string | null; childPhone?: string | null }[] }[];
};
