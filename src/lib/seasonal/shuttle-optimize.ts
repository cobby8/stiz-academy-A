import { getSeasonalShuttleRoster } from "@/lib/seasonal/shuttle-roster";
import { requireAdmin } from "@/lib/auth-guard";

// 방학특강 셔틀 노선 자동 제안 엔진.
// "자동 제안 + 수동 조정" 원칙: 여기서는 위치·정원·수업시간을 근거로 정차 그룹핑 + 순서 + 예상 시각을 계산해 '초안'을 만든다.
// 실제 도로 소요시간(Tmap) 연동은 후속 단계. v1은 직선거리 기반 근사(도로계수 1.3, 평균 24km/h)로 계산한다.

// 학원 좌표(다산2호점 인근). 필요 시 설정에서 조정 가능하게 확장한다.
const ACADEMY = { lat: 37.62366, lng: 127.15366, name: "STIZ 다산점" };
const ROAD_FACTOR = 1.3;       // 직선 → 도로거리 보정
const SPEED_KM_PER_MIN = 0.4;  // 약 24km/h (도심 셔틀)
const MIN_PER_KM = ROAD_FACTOR / SPEED_KM_PER_MIN; // ≈ 3.25분/km
const STOP_DWELL_MIN = 1.5;    // 정차당 승하차 소요
const PICKUP_BUFFER_MIN = 10;  // 수업 시작 전 학원 도착 여유
const DROPOFF_BUFFER_MIN = 5;  // 수업 종료 후 출발 여유

export type DispatchDirection = "PICKUP" | "DROPOFF";

type Pt = { lat: number; lng: number };

function haversineKm(a: Pt, b: Pt): number {
  const R = 6371, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function segMin(a: Pt, b: Pt): number { return haversineKm(a, b) * MIN_PER_KM + STOP_DWELL_MIN; }
function hhmmToMin(t: string | null): number | null {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":").map(Number); return h * 60 + m;
}
function minToHHMM(x: number): string {
  const v = Math.max(0, Math.round(x)); const h = Math.floor(v / 60) % 24, m = v % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type StopStudent = { name: string; grade: string | null; parentPhone: string | null; childPhone: string | null; requestId: string };
type Stop = { lat: number; lng: number; label: string; students: StopStudent[]; etaLabel?: string };
type Vehicle = { index: number; passengers: number; stops: Stop[] };

export type DispatchSuggestion = {
  direction: DispatchDirection;
  classStart: string | null;
  classEnd: string | null;
  capacity: number;
  academy: typeof ACADEMY;
  vehicles: Vehicle[];
  unassigned: { name: string; label: string | null }[]; // 좌표 없어 배차 불가
  availableClassTimes: string[];
  totalRiders: number;
};

// 학원 기준 최근접(greedy nearest-neighbor) 순서
function nnOrder(stops: Stop[], from: Pt): Stop[] {
  const rest = [...stops]; const out: Stop[] = []; let cur = from;
  while (rest.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < rest.length; i++) { const d = haversineKm(cur, rest[i]); if (d < bd) { bd = d; bi = i; } }
    const next = rest.splice(bi, 1)[0]; out.push(next); cur = next;
  }
  return out;
}

export async function suggestDispatch(opts: { direction: DispatchDirection; classStart?: string | null; capacity?: number }): Promise<DispatchSuggestion> {
  await requireAdmin();
  const direction = opts.direction === "DROPOFF" ? "DROPOFF" : "PICKUP";
  const capacity = Math.max(1, Math.min(45, Math.floor(opts.capacity ?? 9)));

  const roster = (await getSeasonalShuttleRoster()).filter((r) => r.ride);
  const availableClassTimes = Array.from(new Set(roster.map((r) => r.classStart).filter(Boolean) as string[])).sort();
  const classStart = opts.classStart && availableClassTimes.includes(opts.classStart) ? opts.classStart : (availableClassTimes[0] ?? null);

  const pool = roster.filter((r) => (classStart ? r.classStart === classStart : true));
  const classEnd = pool.find((r) => r.classEnd)?.classEnd ?? null;

  const unassigned: { name: string; label: string | null }[] = [];
  const pts = pool.map((r) => {
    const lat = direction === "PICKUP" ? r.pickupLat : (r.dropoffLat ?? r.pickupLat);
    const lng = direction === "PICKUP" ? r.pickupLng : (r.dropoffLng ?? r.pickupLng);
    const label = direction === "PICKUP" ? r.pickupLocation : (r.dropoffSameAsPickup ? r.pickupLocation : r.dropoffLocation) ?? r.pickupLocation;
    return { r, lat, lng, label: label ?? "(위치 미지정)" };
  });
  const usable = pts.filter((p) => { if (p.lat == null || p.lng == null) { unassigned.push({ name: p.r.childName, label: p.label }); return false; } return true; });

  // 같은 좌표(같은 아파트)는 한 정차로 묶는다
  const stopMap = new Map<string, Stop>();
  for (const p of usable) {
    const key = `${p.lat!.toFixed(4)},${p.lng!.toFixed(4)}`;
    if (!stopMap.has(key)) stopMap.set(key, { lat: p.lat!, lng: p.lng!, label: p.label, students: [] });
    stopMap.get(key)!.students.push({ name: p.r.childName, grade: p.r.childGrade, parentPhone: p.r.parentPhone, childPhone: p.r.childPhone, requestId: p.r.requestId });
  }

  // 전체를 학원 기준 최근접순으로 정렬 후 정원에 맞춰 차량으로 분할
  const ordered = nnOrder([...stopMap.values()], ACADEMY);
  const vehicles: Vehicle[] = [];
  let cur: Vehicle = { index: 1, passengers: 0, stops: [] };
  for (const stop of ordered) {
    const n = stop.students.length;
    if (cur.stops.length > 0 && cur.passengers + n > capacity) {
      vehicles.push(cur); cur = { index: vehicles.length + 1, passengers: 0, stops: [] };
    }
    cur.stops.push(stop); cur.passengers += n;
  }
  if (cur.stops.length) vehicles.push(cur);

  // 차량별로 경로·예상 시각 계산 (각 차량은 학원에서 독립적으로 출발/도착)
  const classStartMin = hhmmToMin(classStart);
  const classEndMin = hhmmToMin(classEnd);
  for (const v of vehicles) {
    // 차량 내부 정차 순서: 학원 기준 최근접
    let path = nnOrder(v.stops, ACADEMY);
    if (direction === "PICKUP") path = path.reverse(); // 등원: 먼 곳부터 태우고 학원에서 끝
    v.stops = path;

    if (direction === "PICKUP" && classStartMin != null) {
      // 학원 도착 목표 = 수업시작 - 버퍼. 마지막 정차→학원부터 역산.
      const arrive = classStartMin - PICKUP_BUFFER_MIN;
      const times: number[] = new Array(path.length);
      let acc = arrive - segMin(path[path.length - 1], ACADEMY);
      times[path.length - 1] = acc;
      for (let i = path.length - 2; i >= 0; i--) { acc -= segMin(path[i], path[i + 1]); times[i] = acc; }
      path.forEach((s, i) => { s.etaLabel = `${minToHHMM(times[i])} 승차`; });
    } else if (direction === "DROPOFF" && classEndMin != null) {
      const depart = classEndMin + DROPOFF_BUFFER_MIN;
      let acc = depart + segMin(ACADEMY, path[0]);
      path[0].etaLabel = `${minToHHMM(acc)} 하차`;
      for (let i = 1; i < path.length; i++) { acc += segMin(path[i - 1], path[i]); path[i].etaLabel = `${minToHHMM(acc)} 하차`; }
    }
  }

  return {
    direction, classStart, classEnd, capacity, academy: ACADEMY,
    vehicles, unassigned, availableClassTimes,
    totalRiders: usable.length,
  };
}
