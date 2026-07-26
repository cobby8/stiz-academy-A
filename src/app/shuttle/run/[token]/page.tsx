import { computeDispatch } from "@/lib/seasonal/shuttle-optimize";
import { getSavedDispatchRoute } from "@/lib/seasonal/dispatchRoute";
import { resolveRunToken, getBoardingMap } from "@/lib/seasonal/shuttleRun";
import DriverRunClient, { type DriverVehicle } from "@/components/seasonal/DriverRunClient";

export const dynamic = "force-dynamic";

// 기사님 전용 운행 화면 — 로그인 없이 토큰으로 접근. 토큰이 유효할 때만 그 날 노선·명단·연락처를 보여준다.
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

  const suggestion = await computeDispatch({ direction: run.direction, date: run.date });
  const saved = await getSavedDispatchRoute(run.date, run.direction);
  const vehiclesRaw = (saved?.vehicles as DispatchVehicleLike[] | undefined) ?? (suggestion.vehicles as DispatchVehicleLike[]);
  const boarding = await getBoardingMap(run.date, run.direction);

  const isPickup = run.direction === "PICKUP";
  const startName = isPickup ? (suggestion.depot?.name ?? "차고지") : suggestion.academy.name;
  const endName = isPickup ? suggestion.academy.name : (suggestion.depot?.name ?? "차고지");

  const vehicles: DriverVehicle[] = vehiclesRaw.map((v) => ({
    vehicleName: v.vehicleName,
    tripLabel: v.tripLabel ?? null,
    departTime: v.departTime ?? null,
    arriveTime: v.arriveTime ?? null,
    depotTime: v.depotTime ?? null,
    stops: (v.stops ?? []).map((s) => ({
      label: s.label,
      isHub: Boolean(s.isHub),
      etaLabel: s.etaLabel ?? null,
      students: (s.students ?? []).map((st) => ({
        requestId: st.requestId,
        name: st.name,
        grade: st.grade ?? null,
        parentPhone: st.parentPhone ?? null,
        childPhone: st.childPhone ?? null,
      })),
    })),
  }));

  return (
    <DriverRunClient
      token={token}
      date={run.date}
      direction={run.direction}
      startName={startName.replace(/^(STIZ 다산점 · |차고지 · )/, "")}
      endName={endName.replace(/^(STIZ 다산점 · |차고지 · )/, "")}
      vehicles={vehicles}
      initialBoarding={boarding}
    />
  );
}

// 저장본/계산본 vehicles의 느슨한 형태(둘 다 같은 구조).
type DispatchVehicleLike = {
  vehicleName: string; tripLabel?: string | null;
  departTime?: string | null; arriveTime?: string | null; depotTime?: string | null;
  stops?: { label: string; isHub?: boolean; etaLabel?: string | null; students?: { requestId: string; name: string; grade?: string | null; parentPhone?: string | null; childPhone?: string | null }[] }[];
};
