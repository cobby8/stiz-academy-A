import { computeDispatch, getDispatchForView } from "@/lib/seasonal/shuttle-optimize";
import { resolveRunToken, getBoardingMap, type BoardingStatus } from "@/lib/seasonal/shuttleRun";
import DriverRunClient, { type DriverSection } from "@/components/seasonal/DriverRunClient";

export const dynamic = "force-dynamic";

const PREFIX = /^(STIZ 다산점 · |차고지 · )/;

function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
// YYYY-MM-DD 형식+달력 유효성 검증. 클라가 보낸 date 쿼리는 신뢰하지 않고 서버에서 확인.
function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00+09:00`);
  return !Number.isNaN(d.getTime()) &&
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d) === s;
}
// 운행 가능일(정렬됨) 기준으로 현재 날짜의 이전/다음 운행일을 구한다.
// 현재 날짜가 운행일 목록에 있으면 인덱스 ±1, 없으면(임의 날짜) 가장 가까운 이전/다음 운행일.
function adjacentRunDates(dates: string[], current: string): { prev: string | null; next: string | null } {
  const idx = dates.indexOf(current);
  if (idx >= 0) return { prev: dates[idx - 1] ?? null, next: dates[idx + 1] ?? null };
  const prev = dates.filter((d) => d < current).pop() ?? null;
  const next = dates.find((d) => d > current) ?? null;
  return { prev, next };
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
export default async function ShuttleRunPage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { token } = await params;
  const run = await resolveRunToken(token);
  if (!run) return lightError("유효하지 않은 링크입니다", "원장님께 새 링크를 요청해주세요.");

  // 운행 가능일 목록(정렬) — 이전/다음 이동 계산과 기본 날짜 산정에 쓴다.
  const probe = await computeDispatch({ direction: "PICKUP", date: null, localOnly: true });
  const availableDates = probe.availableDates.map((d) => d.date).sort();
  const today = todayKST();

  // date 쿼리가 유효한 YYYY-MM-DD면 그 날짜를 우선 사용(클라 입력은 서버에서 검증).
  const sp = await searchParams;
  const requestedDate = sp?.date && isValidDate(sp.date) ? sp.date : null;

  // 기본 날짜: 기사 링크는 어떤 링크든(ROLLING이든 특정일 고정이든) **항상 오늘**(현재 KST)로 연다.
  // 기사님은 늘 '당일 운행'을 보므로, 링크에 박힌 날짜는 무시하고 오늘을 기본으로 한다.
  // 오늘 운행이 없어도 어제로 떨어지지 않고 오늘을 띄우며, 다른 날은 이전/다음 네비/?date=로 본다.
  const effectiveDate: string = requestedDate ?? today;

  // 운행 가능일 기준 이전/다음(범위 밖이면 null → 버튼 비활성).
  const { prev: prevDate, next: nextDate } = adjacentRunDates(availableDates, effectiveDate);

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
        prevDate={prevDate}
        nextDate={nextDate}
        today={today}
      />
    </div>
  );
}

type DispatchVehicleLike = {
  vehicleName: string; tripLabel?: string | null;
  departTime?: string | null; arriveTime?: string | null; depotTime?: string | null;
  stops?: { label: string; isHub?: boolean; etaLabel?: string | null; lat?: number; lng?: number; students?: { requestId: string; name: string; grade?: string | null; parentPhone?: string | null; childPhone?: string | null }[] }[];
};
