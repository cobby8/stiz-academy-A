/**
 * 기사님 전용 통합 URL: /driver/[token]
 * 토큰 타입을 자동 감지(정규 → 방학특강 순서로 확인)해 올바른 운행 화면을 렌더링한다.
 * 기사님께는 이 URL 하나만 공유하면 된다.
 */

import { isRegularRunToken, getRegularBoardingMap, getRegularAbsentPeople } from "@/lib/shuttle/regularRun";
import { getRegularShuttleStops } from "@/lib/shuttle/regularImport";
import { matchAbsentee, type AbsentPerson } from "@/lib/regular/regularAbsenceMatch";
import RegularDriverClient, { type DriverClass, type DriverStop } from "@/components/shuttle/RegularDriverClient";
import type { RegularShuttleStop } from "@/lib/shuttle/regularSheet";

import { resolveRunToken, getBoardingMap, type BoardingStatus } from "@/lib/seasonal/shuttleRun";
import { computeDispatch, getDispatchForView } from "@/lib/seasonal/shuttle-optimize";
import DriverRunClient, { type DriverSection } from "@/components/seasonal/DriverRunClient";

export const dynamic = "force-dynamic";

// ─── 공통 유틸 ────────────────────────────────────────────────────────────────

function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00+09:00`);
  return !Number.isNaN(d.getTime()) &&
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d) === s;
}
function addDays(dateIso: string, n: number): string {
  const d = new Date(`${dateIso}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function weekdayOf(dateIso: string): number {
  return new Date(`${dateIso}T12:00:00+09:00`).getUTCDay();
}
function adjacentRunDates(dates: string[], current: string): { prev: string | null; next: string | null } {
  const idx = dates.indexOf(current);
  if (idx >= 0) return { prev: dates[idx - 1] ?? null, next: dates[idx + 1] ?? null };
  const prev = dates.filter((d) => d < current).pop() ?? null;
  const next = dates.find((d) => d > current) ?? null;
  return { prev, next };
}

function LightError({ title, sub }: { title: string; sub: string }) {
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

// ─── 방학특강 렌더 ─────────────────────────────────────────────────────────────

const PREFIX = /^(STIZ 다산점 · |차고지 · )/;

type DispatchVehicleLike = {
  vehicleName: string; tripLabel?: string | null;
  departTime?: string | null; arriveTime?: string | null; depotTime?: string | null;
  stops?: {
    label: string; isHub?: boolean; etaLabel?: string | null; lat?: number; lng?: number;
    students?: { requestId: string; name: string; grade?: string | null; parentPhone?: string | null; childPhone?: string | null }[];
  }[];
};

async function SeasonalDriverPage({ token, date, searchDate }: { token: string; date: string | "ROLLING"; searchDate: string | null }) {
  const probe = await computeDispatch({ direction: "PICKUP", date: null, localOnly: true });
  const availableDates = probe.availableDates.map((d) => d.date).sort();
  const today = todayKST();

  let effectiveDate: string | null = searchDate;
  if (!effectiveDate) effectiveDate = date === "ROLLING" ? today : date;
  if (!effectiveDate) return <LightError title="오늘은 운행이 없습니다" sub="다음 운행일에 다시 열어주세요." />;

  const { prev: prevDate, next: nextDate } = adjacentRunDates(availableDates, effectiveDate);

  const directions: ("PICKUP" | "DROPOFF")[] = ["PICKUP", "DROPOFF"];
  const sections: DriverSection[] = await Promise.all(directions.map(async (d) => {
    const sug = await getDispatchForView(effectiveDate, d, false);
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

  const [pickupBoarding, dropoffBoarding] = await Promise.all([
    getBoardingMap(effectiveDate, "PICKUP"),
    getBoardingMap(effectiveDate, "DROPOFF"),
  ]);

  return (
    <div className="min-h-screen bg-white py-2" style={{ colorScheme: "light" }}>
      <DriverRunClient
        token={token} date={effectiveDate} sections={sections}
        initialBoarding={{ PICKUP: pickupBoarding, DROPOFF: dropoffBoarding } as { PICKUP: Record<string, BoardingStatus>; DROPOFF: Record<string, BoardingStatus> }}
        prevDate={prevDate} nextDate={nextDate} today={today}
      />
    </div>
  );
}

// ─── 정규 셔틀 렌더 ────────────────────────────────────────────────────────────

function groupDriverStops(rows: RegularShuttleStop[], direction: "BOARD" | "ALIGHT", absentees: AbsentPerson[]): DriverStop[] {
  const order: string[] = [];
  const map = new Map<string, DriverStop>();
  for (const r of rows) {
    if (r.direction !== direction || !r.studentName || !r.id) continue;
    let g = map.get(r.stopName);
    if (!g) { g = { label: r.stopName, arriveTime: r.arriveTime, lat: r.latitude ?? null, lng: r.longitude ?? null, direction, rows: [] }; map.set(r.stopName, g); order.push(r.stopName); }
    if (g.lat == null && r.latitude != null) { g.lat = r.latitude; g.lng = r.longitude ?? null; }
    if (!g.arriveTime && r.arriveTime) g.arriveTime = r.arriveTime;
    const absent = matchAbsentee({ name: r.studentName, phone: r.parentPhone }, absentees) !== null;
    g.rows.push({ rowId: r.id, name: r.studentName, parentPhone: r.parentPhone, studentPhone: r.studentPhone, absent });
  }
  return order.map((k) => map.get(k)!);
}

async function RegularDriverPage({ token, searchDate }: { token: string; searchDate: string | null }) {
  const today = todayKST();
  const viewDate = searchDate ?? today;
  const prevDate = addDays(viewDate, -1);
  const nextDate = addDays(viewDate, 1);

  const weekday = weekdayOf(viewDate);
  const { stops } = await getRegularShuttleStops();
  const dayRows = stops
    .filter((s) => s.weekday === weekday && (s.direction === "BOARD" || s.direction === "ALIGHT") && s.studentName)
    .sort((a, b) => a.sortOrder - b.sortOrder);

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

// ─── 진입점 — 토큰 타입 자동 감지 ─────────────────────────────────────────────

export default async function DriverUnifiedPage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const searchDate = sp?.date && isValidDate(sp.date) ? sp.date : null;

  // 1. 정규 셔틀 토큰인지 먼저 확인 (DB 조회 1회)
  if (await isRegularRunToken(token)) {
    return <RegularDriverPage token={token} searchDate={searchDate} />;
  }

  // 2. 방학특강 토큰 확인
  const run = await resolveRunToken(token);
  if (run) {
    return <SeasonalDriverPage token={token} date={run.date} searchDate={searchDate} />;
  }

  // 3. 둘 다 아니면 에러
  return <LightError title="유효하지 않은 링크입니다" sub="원장님께 새 링크를 요청해주세요." />;
}
