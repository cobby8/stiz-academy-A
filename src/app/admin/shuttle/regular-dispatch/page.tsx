import RegularDispatchClient from "./RegularDispatchClient";
import ShuttleSectionTabs from "../ShuttleSectionTabs";
import SeasonalHeader from "../../seasonal/SeasonalHeader";
import { getRegularShuttleWeekdays } from "@/lib/regular/shuttleRoster";
import { getRegularDispatchForView } from "@/lib/regular/regularDispatchRoute";
import { getRegularShuttleStops, getRegularStopsWithoutCoords } from "@/lib/shuttle/regularImport";
import RegularStopGeocodePanel from "@/components/shuttle/RegularStopGeocodePanel";
import { getRegularShuttleMonths } from "@/lib/shuttle/regularImport";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 정규 셔틀 동적배차(신청서 좌표 기반) — 방학특강 배차 화면을 요일 기준으로 재사용한다.
// 구글시트 정규 셔틀(/admin/shuttle/regular)과는 별개의 새 화면(정합 명단 소스).
export default async function RegularDispatchPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const months = await getRegularShuttleMonths();
  const requestedMonth = (await searchParams).month;
  const serviceMonth = requestedMonth && months.includes(requestedMonth) ? requestedMonth : (months[0] ?? new Date().toISOString().slice(0, 7));
  const weekdays = await getRegularShuttleWeekdays(serviceMonth);
  const initialDay = weekdays[0] ?? "Mon";

  // 좌표 없는 정류장(1회용 좌표 채우기 패널용). 배차 조회와 병렬.
  const [missingStops, regularStops, drivers, [pickup, dropoff]] = await Promise.all([
    getRegularStopsWithoutCoords(serviceMonth),
    getRegularShuttleStops(serviceMonth),
    prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
      `SELECT id, name FROM "User" WHERE role='DRIVER' ORDER BY name`,
    ),
    // 저장본이 있으면 T맵 없이 그대로(제공량 절약). 없을 때만 T맵으로 초안 계산.
    Promise.all([
      getRegularDispatchForView(initialDay, "PICKUP", true, serviceMonth),
      getRegularDispatchForView(initialDay, "DROPOFF", true, serviceMonth),
    ]),
  ]);
  const initialPickup = JSON.parse(JSON.stringify(pickup));
  const initialDropoff = JSON.parse(JSON.stringify(dropoff));
  const totalStopCount = new Set(regularStops.stops.map((stop) => stop.stopName).filter(Boolean)).size;
  const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const classTimeByStudent = new Map<string, { dayOfWeek: string; studentName: string; pickupClassTime: string | null; dropoffClassTime: string | null }>();
  for (const stop of regularStops.stops) {
    if (!stop.studentName || (stop.direction !== "BOARD" && stop.direction !== "ALIGHT")) continue;
    const key = `${stop.weekday}:${stop.studentId ?? stop.studentName.replace(/\s/g, "")}`;
    const row = classTimeByStudent.get(key) ?? { dayOfWeek: dowNames[stop.weekday] ?? "", studentName: stop.studentName, pickupClassTime: null, dropoffClassTime: null };
    if (stop.direction === "BOARD") row.pickupClassTime = stop.classTime;
    if (stop.direction === "ALIGHT") row.dropoffClassTime = stop.classTime;
    classTimeByStudent.set(key, row);
  }
  const classTimeMismatches = [...classTimeByStudent.values()].filter((row) => row.pickupClassTime && row.dropoffClassTime && row.pickupClassTime !== row.dropoffClassTime);

  return (
    <>
      <SeasonalHeader eyebrow="SHUTTLE" title="셔틀 관리" subtitle="정규 수업 셔틀을 요일별로 자동 배차합니다(학생 신청서 좌표 기반)." />
      <ShuttleSectionTabs />
      {/* 1회용 준비 작업: 좌표 없는 정류장이 있으면 좌표 채우기 패널을 배차 위에 노출 */}
      <RegularStopGeocodePanel
        stopNames={missingStops}
        totalStopCount={totalStopCount}
        initialCompletedCount={Math.max(0, totalStopCount - missingStops.length)}
      />
      <RegularDispatchClient
        weekdays={weekdays}
        initialDay={initialDay}
        initialPickup={initialPickup}
        initialDropoff={initialDropoff}
        serviceMonth={serviceMonth}
        months={months}
        classTimeMismatches={classTimeMismatches}
        drivers={drivers}
      />
    </>
  );
}
