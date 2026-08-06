import { isRegularRunToken, getRegularBoardingMap } from "@/lib/shuttle/regularRun";
// 그날 화면에 무엇을 띄울지(원장이 확정한 저장 노선 우선 · 없으면 시트 명단 폴백)는 이 한곳에서 만든다.
import { getRegularDriverClasses } from "@/lib/shuttle/regularDriverRoute";
import RegularDriverClient from "@/components/shuttle/RegularDriverClient";

export const dynamic = "force-dynamic";

function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
// YYYY-MM-DD 형식 검증(달력 유효성까지). 클라가 보낸 date 쿼리는 신뢰하지 않고 서버에서 확인.
function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00+09:00`);
  return !Number.isNaN(d.getTime()) &&
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d) === s;
}
// KST 기준 n일 이동. 정오+09:00에서 UTC 날짜를 더해 날짜 밀림 없이 계산.
function addDays(dateIso: string, n: number): string {
  const d = new Date(`${dateIso}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
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

// 정규 셔틀 기사님 운행 화면 — 토큰으로 접근. 오늘 요일의 수업별 등원·하원 타임라인 + 탑승 체크.
export default async function RegularRunPage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { token } = await params;
  if (!(await isRegularRunToken(token))) return lightError("유효하지 않은 링크입니다", "원장님께 새 링크를 요청해주세요.");

  const today = todayKST();
  // date 쿼리가 유효한 YYYY-MM-DD면 그 날, 없거나 무효면 오늘. (클라 입력은 서버에서 검증)
  const sp = await searchParams;
  const viewDate = sp?.date && isValidDate(sp.date) ? sp.date : today;
  // 정규는 상시 요일 운행 → 달력일 ±1로 이동(주말 등 명단 없어도 이동은 허용).
  const prevDate = addDays(viewDate, -1);
  const nextDate = addDays(viewDate, 1);

  // 명단 없는 날(주말 등)도 빈 화면 + 네비로 계속 넘길 수 있게 early-return 하지 않는다.
  // 그 요일에 저장된 배차 노선이 있으면 그 순서·시각, 없으면 시트 명단 순서('확정 전' 표시).
  const [classes, boarding] = await Promise.all([
    getRegularDriverClasses(viewDate),
    getRegularBoardingMap(viewDate),
  ]);

  return (
    <div className="min-h-screen bg-white py-2" style={{ colorScheme: "light" }}>
      <RegularDriverClient token={token} date={viewDate} classes={classes} initialBoarding={boarding} prevDate={prevDate} nextDate={nextDate} today={today} />
    </div>
  );
}
