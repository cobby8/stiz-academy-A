import { getRegularShuttleStops } from "@/lib/shuttle/regularImport";
import { isRegularRunToken, getRegularBoardingMap, getRegularAbsentPeople } from "@/lib/shuttle/regularRun";
import { matchAbsentee, type AbsentPerson } from "@/lib/regular/regularAbsenceMatch";
import RegularDriverClient, { type DriverClass, type DriverStop } from "@/components/shuttle/RegularDriverClient";
import type { RegularShuttleStop } from "@/lib/shuttle/regularSheet";

export const dynamic = "force-dynamic";

function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
// KST 날짜의 요일(0=일..6=토). 정오 기준으로 계산해 UTC 변환 시 날짜가 밀리지 않게 한다.
function weekdayOf(dateIso: string): number {
  return new Date(`${dateIso}T12:00:00+09:00`).getUTCDay();
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

// 같은 정류장(이름)끼리 학생 행을 묶어 정차 하나로. 시트 순서(sortOrder) 유지.
// absentees: 오늘 결석 신고된 사람(이름+학부모전화) — 명단 승객과 근사 매칭해 결석 표식을 단다.
function groupDriverStops(rows: RegularShuttleStop[], direction: "BOARD" | "ALIGHT", absentees: AbsentPerson[]): DriverStop[] {
  const order: string[] = [];
  const map = new Map<string, DriverStop>();
  for (const r of rows) {
    if (r.direction !== direction || !r.studentName || !r.id) continue;
    let g = map.get(r.stopName);
    if (!g) { g = { label: r.stopName, arriveTime: r.arriveTime, lat: r.latitude ?? null, lng: r.longitude ?? null, direction, rows: [] }; map.set(r.stopName, g); order.push(r.stopName); }
    if (g.lat == null && r.latitude != null) { g.lat = r.latitude; g.lng = r.longitude ?? null; }
    if (!g.arriveTime && r.arriveTime) g.arriveTime = r.arriveTime;
    // 결석 매칭: 이름(+가능하면 학부모 전화)으로 오늘 결석자와 이어 붙인다(best-effort).
    const absent = matchAbsentee({ name: r.studentName, phone: r.parentPhone }, absentees) !== null;
    g.rows.push({ rowId: r.id, name: r.studentName, parentPhone: r.parentPhone, studentPhone: r.studentPhone, absent });
  }
  return order.map((k) => map.get(k)!);
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

  const weekday = weekdayOf(viewDate);
  const { stops } = await getRegularShuttleStops();
  const dayRows = stops
    .filter((s) => s.weekday === weekday && (s.direction === "BOARD" || s.direction === "ALIGHT") && s.studentName)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // 명단 없는 날(주말 등)도 빈 화면 + 네비로 계속 넘길 수 있게 early-return 하지 않는다.
  // 선택 날짜의 결석 신고자를 미리 뽑아 명단 행에 결석 표식을 단다.
  const absentees = await getRegularAbsentPeople(viewDate);

  const classTimes = [...new Set(dayRows.map((s) => s.classTime).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b));
  const classes: DriverClass[] = classTimes.map((ct) => {
    const rows = dayRows.filter((s) => s.classTime === ct);
    return { classTime: ct, board: groupDriverStops(rows, "BOARD", absentees), alight: groupDriverStops(rows, "ALIGHT", absentees) };
  });

  const boarding = await getRegularBoardingMap(viewDate);

  return (
    <div className="min-h-screen bg-white py-2" style={{ colorScheme: "light" }}>
      <RegularDriverClient token={token} date={viewDate} classes={classes} initialBoarding={boarding} prevDate={prevDate} nextDate={nextDate} today={today} />
    </div>
  );
}
