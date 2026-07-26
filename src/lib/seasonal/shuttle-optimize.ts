import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { routeFixedOrderWithTmap } from "@/lib/shuttle/tmap";
// 태울 학생 판정은 절대 여기서 하지 않는다. 게이트웨이 한 곳만 통과한다.
// (여기서 WHERE 절을 손으로 다시 쓰다가 취소자·폐강 반 학생이 배차에 실리는 사고가 5번 반복됐다.)
import { getConfirmedShuttleRosterForDate } from "./shuttleRoster";
import { getSavedDispatchRoute } from "./dispatchRoute";
import { planIncrementalInsert, type IncrTarget } from "./dispatchIncrement";

// 방학특강 셔틀 노선 자동 제안 엔진.
// - 그 날짜에 실제 등원(SCHEDULED)하는 셔틀 학생만 배차(요일별 반복 스케줄 반영).
// - 정차 순서는 T맵 경유지 최적화(실도로) 우선, 실패/키없음 시 직선거리 최근접(NN)으로 폴백.
// - 차고지(하루 운행 시작점)를 등원의 출발, 하원의 복귀 지점으로 사용한다.
// - 예상 시각은 T맵 총 소요시간을 정차 간 거리 비율로 배분해 계산(폴백은 직선거리 기준).

type Geo = { lat: number; lng: number; name: string };
const ACADEMY_FALLBACK: Geo = { lat: 37.6145625, lng: 127.1563125, name: "STIZ 다산점" };

const ROAD_FACTOR = 1.3, SPEED_KM_PER_MIN = 0.4;
const MIN_PER_KM = ROAD_FACTOR / SPEED_KM_PER_MIN;
const STOP_DWELL_MIN = 1.5, PICKUP_BUFFER_MIN = 10, DROPOFF_BUFFER_MIN = 5;

export type DispatchDirection = "PICKUP" | "DROPOFF";
type Pt = { lat: number; lng: number };
const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

async function getSettings(): Promise<{ academy: Geo; depot: Geo | null; hub: Geo | null }> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "academyLatitude" AS alat, "academyLongitude" AS alng, "academyAddress" AS aaddr,
              "shuttleDepotLatitude" AS dlat, "shuttleDepotLongitude" AS dlng, "shuttleDepotAddress" AS daddr,
              "shuttleHubLatitude" AS hlat, "shuttleHubLongitude" AS hlng, "shuttleHubName" AS hname
         FROM "AcademySettings" LIMIT 1`,
    );
    const r = rows[0] ?? {};
    const alat = Number(r.alat), alng = Number(r.alng);
    const academy: Geo = Number.isFinite(alat) && Number.isFinite(alng)
      ? { lat: alat, lng: alng, name: r.aaddr ? `STIZ 다산점 · ${r.aaddr}` : "STIZ 다산점" }
      : ACADEMY_FALLBACK;
    const dlat = Number(r.dlat), dlng = Number(r.dlng);
    const depot: Geo | null = Number.isFinite(dlat) && Number.isFinite(dlng)
      ? { lat: dlat, lng: dlng, name: r.daddr ? `차고지 · ${r.daddr}` : "차고지" } : null;
    const hlat = Number(r.hlat), hlng = Number(r.hlng);
    const hub: Geo | null = Number.isFinite(hlat) && Number.isFinite(hlng)
      ? { lat: hlat, lng: hlng, name: (r.hname && String(r.hname)) || "무료 탑승 거점" } : null;
    return { academy, depot, hub };
  } catch { return { academy: ACADEMY_FALLBACK, depot: null, hub: null }; }
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
// 무료탑승 거점에서 타는 학생 판정 — 명단 화면(isFreeHubRow)과 같은 기준(라벨에 '무료탑승' 포함).
function isFreeHubLabel(label: string | null | undefined): boolean {
  return (label ?? "").replace(/\s/g, "").includes("무료탑승");
}

// rosterId(확정본) 또는 requestId(원본)로 그 학생의 명단 행을 되짚는다. 화면에서 무료탑승으로 옮길 때 쓴다.
type StopStudent = { name: string; grade: string | null; parentPhone: string | null; childPhone: string | null; rosterId: string | null; requestId: string; pickupLabel: string };
type Stop = { lat: number; lng: number; label: string; students: StopStudent[]; approx: boolean; isHub?: boolean; etaLabel?: string };
type Run = {
  index: number; vehicleName: string; plate: string | null; capacity: number; tripLabel: string | null;
  passengers: number; stops: Stop[]; over: boolean;
  provider: "TMAP" | "LOCAL"; tmapMinutes: number | null; tmapKm: number | null; depotTime: string | null;
  // 첫 노드 출발 시각 / 마지막 노드 도착 시각. 등원=차고지 출발·학원 도착, 하원=학원 출발·차고지 복귀.
  // 화면에서 출발 시각을 직접 조정할 때 기준값으로 쓴다.
  departTime: string | null; arriveTime: string | null;
  // T맵 실도로 경로 좌표(출발→…→도착). 지도에 경로를 그릴 때 쓴다. 직선 추정이면 없음.
  path?: { lat: number; lng: number }[];
};

export type DispatchSuggestion = {
  direction: DispatchDirection;
  date: string | null; dow: string | null;
  classStart: string | null; classEnd: string | null;
  academy: Geo; depot: Geo | null; hub: Geo | null;
  vehicles: Run[];
  unassigned: { name: string; label: string | null }[];
  availableDates: { date: string; label: string }[];
  totalRiders: number;
  vehicleFleet: { name: string; plate: string | null; capacity: number }[];
  routingProvider: "TMAP" | "LOCAL"; // 전체적으로 T맵이 쓰였는지
  // 저장 노선 이후의 변동(Phase 2a). 저장본이 있을 때만 채워지고, 관리자 배너 표시에만 쓴다.
  // 기사님 화면(DriverRunClient)은 이 필드를 읽지 않으므로 노출되지 않는다.
  added?: { requestId: string; name: string }[];
  locationChanged?: { requestId: string; name: string }[];
};

function nnOrder(stops: Stop[], from: Pt): Stop[] {
  const rest = [...stops]; const out: Stop[] = []; let cur: Pt = from;
  while (rest.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < rest.length; i++) { const d = haversineKm(cur, rest[i]); if (d < bd) { bd = d; bi = i; } }
    const nx = rest.splice(bi, 1)[0]; out.push(nx); cur = nx;
  }
  return out;
}

// 한 차량(run)의 경로·시각 계산. 등원: 차고지→정차→학원 / 하원: 학원→정차→차고지.
// keepOrder=true면 NN 재정렬을 하지 않고 run.stops 순서를 그대로 쓴다(증분 재배차 = 저장 순서 보존).
async function planRun(run: Run, direction: DispatchDirection, academy: Geo, depot: Geo | null, csMin: number | null, ceMin: number | null, localOnly = false, keepOrder = false) {
  const startPt: Geo = direction === "PICKUP" ? (depot ?? academy) : academy;
  const endPt: Geo = direction === "PICKUP" ? academy : (depot ?? academy);
  // 순서는 최근접(NN)으로 정한다. routeOptimization(최적경로) API는 제공량이 작아 429가 잦으므로 쓰지 않고,
  // 제공량이 넉넉한 /routes(다중경로)로 그 순서의 실도로 경로·시간을 받는다(순서 변경 재계산과 동일 방식).
  // ★ keepOrder면 재정렬 없이 이미 잡힌 순서를 그대로 유지한다(증분 삽입 결과 보존).
  let order = keepOrder ? [...run.stops] : nnOrder(run.stops, startPt);
  run.provider = "LOCAL"; run.tmapMinutes = null; run.tmapKm = null; run.path = undefined;

  if (!localOnly && run.stops.length >= 1) {
    try {
      const res = await routeFixedOrderWithTmap({
        start: { lat: startPt.lat, lng: startPt.lng },
        end: { lat: endPt.lat, lng: endPt.lng },
        waypoints: order.map((s) => ({ lat: s.lat, lng: s.lng })),
      });
      run.provider = "TMAP";
      run.tmapMinutes = res.totalTime > 0 ? Math.round(res.totalTime / 60) : null;
      run.tmapKm = res.totalDistance > 0 ? Math.round(res.totalDistance / 100) / 10 : null;
      run.path = res.path.length ? res.path : undefined; // 지도에 그릴 실도로 경로
    } catch {
      run.provider = "LOCAL"; run.tmapMinutes = null; run.tmapKm = null; run.path = undefined; // 실패 시 직선 추정
    }
  }

  // 2) 경로 노드: [start, ...정차, end]
  const path: Pt[] = [startPt, ...order, endPt];
  const segs: number[] = [];
  for (let i = 1; i < path.length; i++) segs.push(segMin(path[i - 1], path[i]));
  const sum = segs.reduce((a, b) => a + b, 0) || 1;
  const scale = run.tmapMinutes != null && run.tmapMinutes > 0 ? run.tmapMinutes / sum : 1;
  const segScaled = segs.map((s) => s * scale);

  // 3) 시각 배분
  const times = new Array(path.length).fill(0);
  if (direction === "PICKUP") {
    times[path.length - 1] = (csMin ?? 0) - PICKUP_BUFFER_MIN; // 학원 도착
    for (let i = path.length - 2; i >= 0; i--) times[i] = times[i + 1] - segScaled[i];
  } else {
    times[0] = (ceMin ?? 0) + DROPOFF_BUFFER_MIN; // 학원 출발
    for (let i = 1; i < path.length; i++) times[i] = times[i - 1] + segScaled[i - 1];
  }
  order.forEach((s, i) => { s.etaLabel = `${minToHHMM(times[i + 1])} ${direction === "PICKUP" ? "승차" : "하차"}`; });
  run.stops = order;
  run.depotTime = depot ? minToHHMM(direction === "PICKUP" ? times[0] : times[path.length - 1]) : null;
  // 첫 노드 출발/마지막 노드 도착(방향 무관 대칭). 출발 시각 수동 조정의 기준값.
  run.departTime = minToHHMM(times[0]);
  run.arriveTime = minToHHMM(times[path.length - 1]);
}

export async function suggestDispatch(opts: { direction: DispatchDirection; date?: string | null }): Promise<DispatchSuggestion> {
  await requireAdmin();
  return computeDispatch(opts);
}

/**
 * 조회용 노선 — T맵 제공량을 아끼는 게 목적이다.
 *   1) 저장된(원장 확정) 노선이 있으면 그걸 그대로 쓴다(T맵 0회). 기준정보만 T맵 없이 채운다.
 *   2) 없으면: allowTmap=true면 T맵으로 새로 계산(관리자 첫 진입), false면 직선 추정(기사님 화면).
 * "볼 때"는 절대 T맵을 부르지 않도록 하는 진입점. 실제 T맵 호출은 "편집(자동 제안·순서 변경)"에서만.
 */
export async function getDispatchForView(date: string | null, direction: DispatchDirection, allowTmap: boolean): Promise<DispatchSuggestion> {
  // 먼저 T맵 없이 기준정보(+날짜 확정)를 얻는다. NN 정렬은 순수 계산이라 외부 호출 0.
  const base = await computeDispatch({ direction, date, localOnly: true });
  const resolvedDate = base.date;
  const saved = resolvedDate ? await getSavedDispatchRoute(resolvedDate, direction) : null;
  if (saved && Array.isArray(saved.vehicles) && saved.vehicles.length) {
    return {
      ...base,
      vehicles: saved.vehicles as DispatchSuggestion["vehicles"],
      classStart: saved.classStart ?? base.classStart,
      classEnd: saved.classEnd ?? base.classEnd,
      routingProvider: "TMAP",
      // 저장 노선 이후의 변동을 그대로 전달(관리자 배너용). 기사님 화면은 이 필드를 매핑하지 않는다.
      added: saved.added,
      locationChanged: saved.locationChanged,
    };
  }
  // 저장본이 없을 때만: 관리자 첫 진입은 T맵으로 계산, 기사님 화면은 직선 추정(base) 그대로.
  return allowTmap ? computeDispatch({ direction, date: resolvedDate, localOnly: false }) : base;
}

// 인증 없이 노선을 계산한다. 관리자 경로는 suggestDispatch(requireAdmin)로만 부르고,
// 기사님 전용 링크는 유효 토큰을 확인한 뒤 이 함수를 직접 부른다(토큰이 관리자 인증을 대신함).
export async function computeDispatch(opts: { direction: DispatchDirection; date?: string | null; localOnly?: boolean }): Promise<DispatchSuggestion> {
  const direction = opts.direction === "DROPOFF" ? "DROPOFF" : "PICKUP";
  const localOnly = opts.localOnly === true; // true면 T맵 미호출(직선 추정) — 조회·기사님 화면에서 제공량 절약
  const { academy, depot, hub } = await getSettings();

  // ⚠️ 태울 학생은 게이트웨이 한 곳으로만 읽는다.
  // 여기서 SQL을 새로 쓸 때마다 취소자·폐강 반 필터가 빠지는 사고가 반복됐다(5회).
  // 운행일 후보와 그날 명단을 한 번에 받아 오므로 이 파일에는 대상자 쿼리가 아예 없다.
  const plan = await getConfirmedShuttleRosterForDate(opts.date ?? null, direction);
  const availableDates = plan.availableDates.map((x) => {
    const [, mm, dd] = x.date.split("-");
    return { date: x.date, label: `${Number(mm)}/${Number(dd)} (${DOW_KO[x.dow]})` };
  });
  const date = plan.date;
  const dow = date ? (availableDates.find((x) => x.date === date)?.label.match(/\((.)\)/)?.[1] ?? null) : null;

  const vehRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT name, "plateNumber" AS plate, capacity FROM "ShuttleVehicle" WHERE "isActive" = true ORDER BY name ASC`,
  );
  const fleet = vehRows.map((v) => ({ name: String(v.name), plate: v.plate ?? null, capacity: Math.max(1, Number(v.capacity) || 1) }));
  const vehicleFleet = fleet.length ? fleet : [{ name: "미등록 차량", plate: null, capacity: 9 }];

  const base: DispatchSuggestion = {
    direction, date, dow, classStart: null, classEnd: null, academy, depot, hub,
    vehicles: [], unassigned: [], availableDates, totalRiders: 0, vehicleFleet, routingProvider: "LOCAL",
  };
  if (!date) return base;

  // 그날 태울 사람. 방향에 맞는 위치(하원=등원 동일 옵션 포함)는 게이트웨이가 이미 골라 준다.
  const riders = plan.riders;
  if (riders.length === 0) return base;

  const classStart = plan.classStart;
  const classEnd = plan.classEnd;

  const unassigned: { name: string; label: string | null }[] = [];
  const stopMap = new Map<string, Stop>();
  // 무료 탑승 거점(1호점 등)은 등록 인원과 무관하게 항상 경유한다. 지정 학생이 없으면 워크인만 태우는 빈 정류장으로 남는다.
  const hubStop: Stop | null = hub ? { lat: hub.lat, lng: hub.lng, label: hub.name, students: [], approx: false, isHub: true } : null;
  for (const r of riders) {
    const student: StopStudent = {
      name: r.studentName, grade: r.childGrade, parentPhone: r.parentPhone, childPhone: r.childPhone,
      rosterId: r.rosterId, requestId: r.shuttleRequestId, pickupLabel: r.placeLabel,
    };
    // '무료탑승'으로 지정된 학생은 집이 아니라 거점에서 타고(등원)/내린다(하원). 좌표가 없어도 배차 가능.
    if (hubStop && isFreeHubLabel(r.placeLabel)) { hubStop.students.push(student); continue; }
    const { latitude: lat, longitude: lng } = r.place;
    const label = r.placeLabel;
    if (lat == null || lng == null) { unassigned.push({ name: r.studentName, label }); continue; }
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (!stopMap.has(key)) stopMap.set(key, { lat, lng, label, students: [], approx: !pinnedSrc(r.place.source) });
    stopMap.get(key)!.students.push(student);
  }

  const allStops: Stop[] = [...stopMap.values()];
  if (hubStop) allStops.push(hubStop);

  // 정원 배차: 차고지(등원)/학원(하원) 기준 최근접순으로 채운 뒤, 정원 초과 시 같은 차량 추가 운행
  const fillFrom: Pt = direction === "PICKUP" ? (depot ?? academy) : academy;
  const ordered = nnOrder(allStops, fillFrom);
  const runs: Run[] = [];
  const tripByVeh: Record<number, number> = {};
  let vi = 0;
  const mkRun = (): Run => {
    const idx = Math.min(vi, vehicleFleet.length - 1);
    const veh = vehicleFleet[idx];
    tripByVeh[idx] = (tripByVeh[idx] ?? 0) + 1;
    const trip = tripByVeh[idx];
    const reused = vi >= vehicleFleet.length;
    return { index: runs.length + 1, vehicleName: veh.name, plate: veh.plate, capacity: veh.capacity, tripLabel: reused || trip > 1 ? `${trip}차 운행` : null, passengers: 0, stops: [], over: false, provider: "LOCAL", tmapMinutes: null, tmapKm: null, depotTime: null, departTime: null, arriveTime: null };
  };
  let run = mkRun();
  for (const stop of ordered) {
    const n = stop.students.length;
    if (run.stops.length > 0 && run.passengers + n > run.capacity) { runs.push(run); vi++; run = mkRun(); }
    run.stops.push(stop); run.passengers += n;
  }
  if (run.stops.length) runs.push(run);

  const csMin = hhmmToMin(classStart), ceMin = hhmmToMin(classEnd);
  for (const v of runs) { await planRun(v, direction, academy, depot, csMin, ceMin, localOnly); v.over = v.passengers > v.capacity; }

  return {
    direction, date, dow, classStart, classEnd, academy, depot, hub,
    vehicles: runs, unassigned, availableDates,
    totalRiders: riders.length - unassigned.length, vehicleFleet,
    routingProvider: runs.some((r) => r.provider === "TMAP") ? "TMAP" : "LOCAL",
  };
}

/**
 * 증분 재배차(Phase 2b) — 저장된 노선의 기존 정차 순서를 **그대로 두고**, 신규·복귀·위치변경 학생만
 * cheapest-insertion으로 가장 적합한 위치에 끼워넣은 뒤, 변경된 차량만 순서 고정으로 T맵 시간을 다시 계산한다.
 * ★ 전체 재최적화(suggestDispatch/computeDispatch) 금지 — 기존 정차 상호 순서를 절대 재배열하지 않는다.
 *
 * 저장본이 없으면 전체 자동배차(computeDispatch)로 폴백한다(끼워넣을 기준 노선이 없으므로).
 */
export async function incrementalDispatch(opts: { direction: DispatchDirection; date?: string | null }): Promise<DispatchSuggestion> {
  await requireAdmin();
  const direction = opts.direction === "DROPOFF" ? "DROPOFF" : "PICKUP";

  // 1) 기준정보(+날짜 확정)를 T맵 없이 얻는다. 저장본이 있으면 base.vehicles는 쓰지 않는다.
  const base = await computeDispatch({ direction, date: opts.date ?? null, localOnly: true });
  const date = base.date;
  if (!date) return base;

  // 2) 저장된 노선(reconcile=제거 반영)과 added/locationChanged를 얻는다. 없으면 전체 재최적화로 폴백.
  const saved = await getSavedDispatchRoute(date, direction);
  if (!saved || !Array.isArray(saved.vehicles) || saved.vehicles.length === 0) {
    return computeDispatch({ direction, date, localOnly: false });
  }

  // 3) 삽입 대상 = added(신규·복귀) + locationChanged(위치변경). 그날 유효 명단에서 학생 정보를 되짚는다.
  const plan = await getConfirmedShuttleRosterForDate(date, direction);
  const riderById = new Map(plan.riders.map((r) => [r.shuttleRequestId, r]));
  const targetIds = [
    ...(saved.added ?? []).map((a) => a.requestId),
    ...(saved.locationChanged ?? []).map((c) => c.requestId),
  ];
  const targets: IncrTarget[] = [];
  for (const id of targetIds) {
    const r = riderById.get(id);
    if (!r) continue; // 명단에서 사라졌으면(방어) 건너뛴다.
    const student: StopStudent = {
      name: r.studentName, grade: r.childGrade, parentPhone: r.parentPhone, childPhone: r.childPhone,
      rosterId: r.rosterId, requestId: r.shuttleRequestId, pickupLabel: r.placeLabel,
    };
    const isHub = isFreeHubLabel(r.placeLabel);
    targets.push({
      requestId: r.shuttleRequestId,
      student: student as unknown as Record<string, unknown>,
      name: r.studentName,
      lat: isHub ? null : (r.place.latitude ?? null),
      lng: isHub ? null : (r.place.longitude ?? null),
      label: r.placeLabel,
      approx: !pinnedSrc(r.place.source),
      isHub,
    });
  }

  // 4) 순수 로직으로 삽입(기존 순서 보존). start/end는 방향에 맞춘 차고지/학원 기준.
  const { academy, depot } = base;
  const startPt = direction === "PICKUP" ? (depot ?? academy) : academy;
  const endPt = direction === "PICKUP" ? academy : (depot ?? academy);
  const result = planIncrementalInsert(
    saved.vehicles,
    targets,
    { start: { lat: startPt.lat, lng: startPt.lng }, end: { lat: endPt.lat, lng: endPt.lng } },
  );

  // 5) 삽입/제거로 정차 기하가 바뀐 차량만 순서 고정으로 T맵 재계산(path·시간·eta 갱신). 나머지는 그대로.
  const vehicles = result.vehicles as Run[];
  const classStart = saved.classStart ?? base.classStart;
  const classEnd = saved.classEnd ?? base.classEnd;
  const csMin = hhmmToMin(classStart), ceMin = hhmmToMin(classEnd);
  for (const vi of result.reroute) {
    const v = vehicles[vi];
    if (!v) continue;
    await planRun(v, direction, academy, depot, csMin, ceMin, false, /* keepOrder */ true);
    v.over = v.passengers > v.capacity;
  }

  const totalStudents = vehicles.reduce((acc, v) => acc + (v.passengers ?? 0), 0);
  return {
    ...base,
    classStart, classEnd,
    vehicles,
    unassigned: result.unassigned,
    totalRiders: totalStudents,
    routingProvider: vehicles.some((v) => v.provider === "TMAP") ? "TMAP" : "LOCAL",
    // 삽입을 반영했으므로 배너의 변동 목록은 비운다(이번 재배차로 처리됨).
    added: [],
    locationChanged: [],
  };
}
