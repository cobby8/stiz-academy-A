import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
// 태울 학생 판정 기준은 반드시 공용 모듈에서만 가져온다.
// 화면마다 WHERE 절을 새로 손으로 쓰다가 취소자·폐강 반 학생이 배차에 실리는 사고가 반복됐다.
import { seasonalShuttleEligibilitySql } from "./shuttleEligibility";

// 방학특강 셔틀 노선 자동 제안 엔진.
// 핵심: "그 날짜에 실제 등원하는 셔틀 학생"만 배차한다(요일별 반복 스케줄 = 학생별 수강 요일 반영).
//   → SpecialProgramEnrollmentDate(SCHEDULED)를 기준으로, 선택한 날짜의 세션이 있는 학생만 포함.
// 차량은 등록된 ShuttleVehicle(정원)로 배차한다. 임의 정원 옵션은 쓰지 않는다.
// v1 예상 시각은 직선거리 기반 근사(도로계수 1.3, 평균 24km/h). Tmap 실도로 연동은 후속.

type Academy = { lat: number; lng: number; name: string };
const ACADEMY_FALLBACK: Academy = { lat: 37.6145625, lng: 127.1563125, name: "STIZ 다산점" };

const ROAD_FACTOR = 1.3;
const SPEED_KM_PER_MIN = 0.4; // ≈24km/h
const MIN_PER_KM = ROAD_FACTOR / SPEED_KM_PER_MIN;
const STOP_DWELL_MIN = 1.5;
const PICKUP_BUFFER_MIN = 10;
const DROPOFF_BUFFER_MIN = 5;

export type DispatchDirection = "PICKUP" | "DROPOFF";
type Pt = { lat: number; lng: number };

const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

async function getAcademy(): Promise<Academy> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "academyLatitude" AS lat, "academyLongitude" AS lng, "academyAddress" AS addr FROM "AcademySettings" LIMIT 1`,
    );
    const r = rows[0];
    const lat = r?.lat != null ? Number(r.lat) : NaN;
    const lng = r?.lng != null ? Number(r.lng) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, name: r?.addr ? `STIZ 다산점 · ${r.addr}` : "STIZ 다산점" };
  } catch { /* 폴백 */ }
  return ACADEMY_FALLBACK;
}

function haversineKm(a: Pt, b: Pt): number {
  const R = 6371, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function segMin(a: Pt, b: Pt): number { return haversineKm(a, b) * MIN_PER_KM + STOP_DWELL_MIN; }
function hhmmToMin(t: string | null): number | null { if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minToHHMM(x: number): string { const v = Math.max(0, Math.round(x)); return `${String(Math.floor(v / 60) % 24).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`; }
function pinnedSrc(s: unknown) { return s === "MAP_PIN" || s === "CURRENT_LOCATION"; }

type StopStudent = { name: string; grade: string | null; parentPhone: string | null; childPhone: string | null };
type Stop = { lat: number; lng: number; label: string; students: StopStudent[]; approx: boolean; etaLabel?: string };
type Run = { index: number; vehicleName: string; plate: string | null; capacity: number; tripLabel: string | null; passengers: number; stops: Stop[]; over: boolean };

export type DispatchSuggestion = {
  direction: DispatchDirection;
  date: string | null;        // YYYY-MM-DD
  dow: string | null;         // 월/화/…
  classStart: string | null;
  classEnd: string | null;
  academy: Academy;
  vehicles: Run[];
  unassigned: { name: string; label: string | null }[];
  availableDates: { date: string; label: string }[];
  totalRiders: number;
  vehicleFleet: { name: string; plate: string | null; capacity: number }[];
};

function nnOrder(stops: Stop[], from: Pt): Stop[] {
  const rest = [...stops]; const out: Stop[] = []; let cur = from;
  while (rest.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < rest.length; i++) { const d = haversineKm(cur, rest[i]); if (d < bd) { bd = d; bi = i; } }
    const nx = rest.splice(bi, 1)[0]; out.push(nx); cur = nx;
  }
  return out;
}

export async function suggestDispatch(opts: { direction: DispatchDirection; date?: string | null }): Promise<DispatchSuggestion> {
  await requireAdmin();
  const direction = opts.direction === "DROPOFF" ? "DROPOFF" : "PICKUP";
  const ACADEMY = await getAcademy();

  // 셔틀 학생이 등원하는 날짜 목록(스케줄 있는 날만)
  const dateRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT (sd."startsAt" AT TIME ZONE 'Asia/Seoul')::date AS d,
            EXTRACT(DOW FROM (sd."startsAt" AT TIME ZONE 'Asia/Seoul'))::int AS dow
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramSessionDate" sd ON sd.id = e."sessionDateId"
       JOIN "SpecialProgramShuttleRequest" r ON r."applicationItemId" = e."applicationItemId"
       -- 공용 대상자 기준(a/it/o)을 그대로 쓰기 위해 신청서·수강항목·개설 반을 함께 조인한다.
       JOIN "SpecialProgramApplication" a ON a.id = r."applicationId"
       JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
       JOIN "SpecialProgramOffering" o ON o.id = it."offeringId"
      WHERE e.status = 'SCHEDULED'
        AND ${seasonalShuttleEligibilitySql({ application: "a", item: "it", offering: "o", shuttleRequest: "r" })}
      ORDER BY d ASC`,
  );
  const availableDates = dateRows.map((r) => {
    const d = String(r.d).slice(0, 10);
    const [, mm, dd] = d.split("-");
    return { date: d, label: `${Number(mm)}/${Number(dd)} (${DOW_KO[Number(r.dow)]})` };
  });
  const date = opts.date && availableDates.some((x) => x.date === opts.date) ? opts.date : (availableDates[0]?.date ?? null);
  const dow = date ? availableDates.find((x) => x.date === date)?.label.match(/\((.)\)/)?.[1] ?? null : null;

  // 등록 차량(활성)
  const vehRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT name, "plateNumber" AS plate, capacity FROM "ShuttleVehicle" WHERE "isActive" = true ORDER BY name ASC`,
  );
  const fleet = vehRows.map((v) => ({ name: String(v.name), plate: v.plate ?? null, capacity: Math.max(1, Number(v.capacity) || 1) }));
  const vehicleFleet = fleet.length ? fleet : [{ name: "미등록 차량", plate: null, capacity: 9 }];

  const empty: DispatchSuggestion = {
    direction, date, dow, classStart: null, classEnd: null, academy: ACADEMY,
    vehicles: [], unassigned: [], availableDates, totalRiders: 0, vehicleFleet,
  };
  if (!date) return empty;

  // 선택 날짜에 실제 등원(SCHEDULED)하는 셔틀 학생
  const riders = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT r.id AS "requestId",
            r."pickupLocation", r."pickupLatitude" AS "pLat", r."pickupLongitude" AS "pLng", r."pickupLocationSource" AS "pSrc",
            r."dropoffLocation", r."dropoffLatitude" AS "dLat", r."dropoffLongitude" AS "dLng", r."dropoffLocationSource" AS "dSrc",
            COALESCE(r."dropoffSameAsPickup", false) AS "same",
            a."childName", a."childGrade", a."childPhone", a."parentPhone",
            to_char(sd."startsAt" AT TIME ZONE 'Asia/Seoul','HH24:MI') AS "classStart",
            to_char(sd."endsAt"   AT TIME ZONE 'Asia/Seoul','HH24:MI') AS "classEnd"
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramSessionDate" sd ON sd.id = e."sessionDateId"
       JOIN "SpecialProgramShuttleRequest" r ON r."applicationItemId" = e."applicationItemId"
       JOIN "SpecialProgramApplication" a ON a.id = r."applicationId"
       -- 공용 대상자 기준(it/o)용 조인. 취소된 수강항목·폐강된 반을 여기서 걸러낸다.
       JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
       JOIN "SpecialProgramOffering" o ON o.id = it."offeringId"
      WHERE e.status = 'SCHEDULED'
        AND (sd."startsAt" AT TIME ZONE 'Asia/Seoul')::date = $1::date
        AND ${seasonalShuttleEligibilitySql({ application: "a", item: "it", offering: "o", shuttleRequest: "r" })}
      ORDER BY "classStart" ASC, a."childName" ASC`,
    date,
  );
  if (riders.length === 0) return { ...empty, classStart: null };

  // 같은 날짜에 시간대가 다른 반이 섞일 수 있다.
  // 등원은 '가장 먼저 시작하는 반', 하원은 '가장 늦게 끝나는 반'을 기준으로 잡아야 안전하다.
  // (하원을 먼저 끝나는 반에 맞추면, 늦게 끝나는 반 학생을 두고 출발한다.)
  const classStart = riders.reduce<string | null>(
    (acc, r) => (r.classStart && (!acc || r.classStart < acc) ? r.classStart : acc), null);
  const classEnd = riders.reduce<string | null>(
    (acc, r) => (r.classEnd && (!acc || r.classEnd > acc) ? r.classEnd : acc), null);

  const unassigned: { name: string; label: string | null }[] = [];
  const stopMap = new Map<string, Stop>();
  for (const r of riders) {
    const lat = direction === "PICKUP" ? r.pLat : (r.dLat ?? r.pLat);
    const lng = direction === "PICKUP" ? r.pLng : (r.dLng ?? r.pLng);
    const label = (direction === "PICKUP" ? r.pickupLocation : (r.same ? r.pickupLocation : r.dropoffLocation)) ?? r.pickupLocation ?? "(위치 미지정)";
    if (lat == null || lng == null) { unassigned.push({ name: r.childName, label }); continue; }
    const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
    const src = direction === "PICKUP" ? r.pSrc : (r.same ? r.pSrc : r.dSrc);
    if (!stopMap.has(key)) stopMap.set(key, { lat: Number(lat), lng: Number(lng), label, students: [], approx: !pinnedSrc(src) });
    stopMap.get(key)!.students.push({ name: r.childName, grade: r.childGrade ?? null, parentPhone: r.parentPhone ?? null, childPhone: r.childPhone ?? null });
  }

  // 학원 기준 최근접순 정렬 후, 등록 차량 정원에 맞춰 순차 배차(정원 초과 시 같은 차량의 추가 운행으로 분리)
  const ordered = nnOrder([...stopMap.values()], ACADEMY);
  const runs: Run[] = [];
  const tripCountByVehicle: Record<number, number> = {};
  let vi = 0;
  const mkRun = (): Run => {
    const veh = vehicleFleet[Math.min(vi, vehicleFleet.length - 1)];
    const reused = vi >= vehicleFleet.length;
    tripCountByVehicle[Math.min(vi, vehicleFleet.length - 1)] = (tripCountByVehicle[Math.min(vi, vehicleFleet.length - 1)] ?? 0) + 1;
    const trip = tripCountByVehicle[Math.min(vi, vehicleFleet.length - 1)];
    return { index: runs.length + 1, vehicleName: veh.name, plate: veh.plate, capacity: veh.capacity, tripLabel: reused || trip > 1 ? `${trip}차 운행` : null, passengers: 0, stops: [], over: false };
  };
  let run = mkRun();
  for (const stop of ordered) {
    const n = stop.students.length;
    if (run.stops.length > 0 && run.passengers + n > run.capacity) { runs.push(run); vi++; run = mkRun(); }
    run.stops.push(stop); run.passengers += n;
  }
  if (run.stops.length) runs.push(run);

  // 차량별 경로·예상 시각
  const csMin = hhmmToMin(classStart), ceMin = hhmmToMin(classEnd);
  for (const v of runs) {
    let path = nnOrder(v.stops, ACADEMY);
    if (direction === "PICKUP") path = path.reverse();
    v.stops = path;
    if (direction === "PICKUP" && csMin != null) {
      const arrive = csMin - PICKUP_BUFFER_MIN;
      let acc = arrive - segMin(path[path.length - 1], ACADEMY);
      const times = new Array(path.length); times[path.length - 1] = acc;
      for (let i = path.length - 2; i >= 0; i--) { acc -= segMin(path[i], path[i + 1]); times[i] = acc; }
      path.forEach((s, i) => { s.etaLabel = `${minToHHMM(times[i])} 승차`; });
    } else if (direction === "DROPOFF" && ceMin != null) {
      let acc = ceMin + DROPOFF_BUFFER_MIN + segMin(ACADEMY, path[0]);
      path[0].etaLabel = `${minToHHMM(acc)} 하차`;
      for (let i = 1; i < path.length; i++) { acc += segMin(path[i - 1], path[i]); path[i].etaLabel = `${minToHHMM(acc)} 하차`; }
    }
    v.over = v.passengers > v.capacity;
  }

  return {
    direction, date, dow, classStart, classEnd, academy: ACADEMY,
    vehicles: runs, unassigned, availableDates,
    totalRiders: riders.length - unassigned.length,
    vehicleFleet,
  };
}
