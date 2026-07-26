// 증분 재배차(cheapest-insertion)의 "순수 로직". 부수효과·DB·T맵 호출이 전혀 없다.
//
// 왜 별도 파일인가(dispatchReconcile.ts / shuttleRosterEdit.ts와 같은 이유):
//   shuttle-optimize.ts는 "@/lib/prisma"·requireAdmin 등 런타임 의존성을 import한다.
//   그 파일에 삽입 로직을 두면 node --test에서 직접 import할 수 없어(별칭·DB 초기화) 실제로
//   돌려 보는 단위 테스트가 불가능하다. 그래서 순수 모듈로 떼어 놓고 caller가 이걸 가져다 쓴다.
//
// ★ 이 모듈이 절대 하지 않는 것: 기존 정차의 상호 순서 재배열. 오직 인접쌍 사이에 "끼워넣기"만 한다.
//   (전체 재최적화(suggestDispatch)와 달리, 원장이 저장한 노선 순서를 그대로 보존한다.)

// haversine 거리(km). shuttle-optimize.ts:49의 공식과 동일하다.
// 순수 모듈을 유지하기 위해(impure 파일 import 금지) 최소 구현을 여기 둔다 — 삽입 비용 계산 전용.
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type LatLng = { lat: number; lng: number };

// 저장 payload의 구조 중 삽입에 필요한 최소 형태. 나머지 필드는 전개(...)로 원본 그대로 보존한다.
type Student = { requestId?: unknown };
type Stop = { lat?: unknown; lng?: unknown; students?: unknown; isHub?: unknown };
type Run = { stops?: unknown; capacity?: unknown };

// 작업용(가변) 내부 타입 — 입력을 얕게 복제해 만든 뒤 여기에만 splice/push 한다.
// students를 unknown[]로 확정해 타입 좁히기 없이 다룬다(나머지 원본 필드는 전개로 보존).
type WorkStop = Record<string, unknown> & { lat?: unknown; lng?: unknown; isHub?: unknown; students: unknown[] };
type WorkRun = Record<string, unknown> & { capacity?: unknown; stops: WorkStop[] };

// 삽입 대상 1명. caller(shuttle-optimize)가 rider를 이 형태로 변환해 넘긴다.
export type IncrTarget = {
  requestId: string;
  /** 정차에 넣을 학생 객체(StopStudent). 구조는 신뢰하지 않고 그대로 실어 나른다. */
  student: Record<string, unknown>;
  /** 학생명(unassigned 표시용). */
  name: string;
  lat: number | null;
  lng: number | null;
  label: string;
  /** 지도 핀이 아닌 추정 좌표면 true(새 정차의 approx 플래그). */
  approx: boolean;
  /** 무료탑승 거점 학생이면 true — 좌표 무시하고 기존 hub 정차에 학생만 추가한다. */
  isHub: boolean;
};

export type IncrGeo = { start: LatLng; end: LatLng };

const COORD_EPSILON = 1e-5; // 동좌표 판정(부동소수 오차 흡수)

function toNum(v: unknown): number | null {
  if (v == null || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function studentsOf(stop: Stop): unknown[] {
  return Array.isArray(stop.students) ? (stop.students as unknown[]) : [];
}
function capacityOf(run: WorkRun): number {
  return typeof run.capacity === "number" ? run.capacity : 0;
}
function passengersOf(run: WorkRun): number {
  return run.stops.reduce((acc, s) => acc + s.students.length, 0);
}

/**
 * 저장된 노선(vehicles)의 순서를 그대로 두고, targets를 cheapest-insertion으로 끼워넣는다. **순수 함수**.
 *
 * 규칙:
 *  - 차량 선택: 정원 여유가 있는 차량 중, 그 학생 삽입 추가비용이 가장 작은 차량.
 *  - 차량 내 위치: 정차열 [start, s1..sn, end]에서 인접쌍(A,B) 사이에 넣을 때
 *    비용 h(A,S)+h(S,B)-h(A,B)가 최소인 위치. 기존 정차 상호 순서는 절대 바꾸지 않는다.
 *  - 동좌표(±1e-5) 기존 정차가 있으면 새 정차를 만들지 않고 그 정차에 학생만 추가.
 *  - 무료탑승(isHub) 학생은 좌표 무시하고 기존 hub 정차에 학생만 추가.
 *  - 정원이 모두 찼거나 좌표가 없으면(비-hub) unassigned로 남긴다(억지 초과 금지).
 *  - 이미 노선에 있는 requestId면(위치변경) 먼저 제거한 뒤 재삽입한다.
 *
 * @returns
 *   vehicles       삽입 반영된 노선(입력을 변형하지 않고 새 배열로 반환).
 *   unassigned     배차 못한 대상({name,label}).
 *   reroute        정차 기하(추가/제거)가 바뀌어 T맵 순서고정 재계산이 필요한 차량 인덱스 집합.
 *                  (동좌표 병합·hub 학생 추가는 기하 불변이라 여기 포함되지 않는다.)
 */
export function planIncrementalInsert(
  vehiclesInput: unknown[],
  targets: IncrTarget[],
  geo: IncrGeo,
): { vehicles: unknown[]; unassigned: { name: string; label: string | null }[]; reroute: number[] } {
  // 입력을 건드리지 않도록 stops/students 배열만 얕게 복제한다(나머지 필드는 전개로 보존).
  const vehicles: WorkRun[] = (Array.isArray(vehiclesInput) ? vehiclesInput : []).map((v) => {
    const run = (v ?? {}) as Run;
    const stops: WorkStop[] = (Array.isArray(run.stops) ? (run.stops as unknown[]) : []).map((s) => {
      const stop = (s ?? {}) as Stop;
      return { ...(s as object), students: [...studentsOf(stop)] } as WorkStop;
    });
    return { ...(v as object), stops } as WorkRun;
  });

  const unassigned: { name: string; label: string | null }[] = [];
  const touched = new Set<number>(); // 인원 재계산 대상(병합·hub 포함)
  const reroute = new Set<number>(); // 기하 변경 → T맵 재계산 대상

  // requestId로 기존 정차에서 그 학생을 제거한다(위치변경 재삽입 전 단계). 빈 정차(비-hub)는 제거.
  const removeExisting = (requestId: string) => {
    vehicles.forEach((v, vi) => {
      let changedGeom = false, changedCount = false;
      v.stops = v.stops.filter((stop) => {
        const before = stop.students.length;
        stop.students = stop.students.filter((st) => String((st as Student)?.requestId ?? "") !== requestId);
        if (stop.students.length !== before) changedCount = true;
        // 학생이 다 빠진 정차는 제거(무료탑승 거점 isHub은 항상 유지).
        if (stop.students.length === 0 && stop.isHub !== true) { changedGeom = true; return false; }
        return true;
      });
      if (changedCount) touched.add(vi);
      if (changedGeom) reroute.add(vi);
    });
  };

  for (const t of targets) {
    // 이미 노선에 있으면(위치변경) 먼저 제거하고 새 좌표로 재삽입한다.
    removeExisting(t.requestId);

    // 1) 무료탑승 거점 학생 — 좌표 무시, 기존 hub 정차에 학생만 추가(새 정차 X, 기하 불변).
    if (t.isHub) {
      let placed = false;
      for (let vi = 0; vi < vehicles.length; vi++) {
        const v = vehicles[vi];
        const hubStop = v.stops.find((s) => s.isHub === true);
        if (!hubStop) continue;
        if (passengersOf(v) + 1 > capacityOf(v)) continue; // 정원 여유 없음
        hubStop.students.push(t.student);
        touched.add(vi);
        placed = true;
        break;
      }
      if (!placed) unassigned.push({ name: t.name, label: t.label });
      continue;
    }

    // 2) 좌표 없는 일반 학생은 배차 불가 → unassigned.
    if (t.lat == null || t.lng == null) { unassigned.push({ name: t.name, label: t.label }); continue; }
    const S: LatLng = { lat: t.lat, lng: t.lng };

    // 3) 차량 선택 + 삽입 위치 결정. 정원 여유가 있는 차량만 후보.
    let best: { vi: number; k: number; mergeIdx: number; cost: number } | null = null;
    for (let vi = 0; vi < vehicles.length; vi++) {
      const v = vehicles[vi];
      if (passengersOf(v) + 1 > capacityOf(v)) continue; // 정원 초과 금지

      // 동좌표(±1e-5) 기존 정차가 있으면 병합(비용 0). 새 정차를 만들지 않는다.
      const mergeIdx = v.stops.findIndex((s) => {
        const slat = toNum(s.lat), slng = toNum(s.lng);
        return slat != null && slng != null && Math.abs(slat - S.lat) <= COORD_EPSILON && Math.abs(slng - S.lng) <= COORD_EPSILON;
      });
      if (mergeIdx >= 0) {
        if (!best || 0 < best.cost) best = { vi, k: -1, mergeIdx, cost: 0 };
        continue;
      }

      // cheapest-insertion: [start, s1..sn, end]의 인접쌍 사이 비용 최소 위치.
      const pts: LatLng[] = [geo.start, ...v.stops.map((s) => ({ lat: toNum(s.lat) ?? 0, lng: toNum(s.lng) ?? 0 })), geo.end];
      let localK = 0, localCost = Infinity;
      for (let k = 0; k < pts.length - 1; k++) {
        const cost = haversineKm(pts[k], S) + haversineKm(S, pts[k + 1]) - haversineKm(pts[k], pts[k + 1]);
        if (cost < localCost) { localCost = cost; localK = k; }
      }
      if (!best || localCost < best.cost) best = { vi, k: localK, mergeIdx: -1, cost: localCost };
    }

    if (!best) { unassigned.push({ name: t.name, label: t.label }); continue; } // 전 차량 만차

    const v = vehicles[best.vi];
    if (best.mergeIdx >= 0) {
      // 동좌표 병합 — 기하 불변(reroute 불필요), 인원만 증가.
      v.stops[best.mergeIdx].students.push(t.student);
      touched.add(best.vi);
    } else {
      // 새 정차를 best.k 위치에 삽입(기존 정차 상호 순서 보존 = splice로 사이에 끼워넣기).
      const newStop: WorkStop = { lat: S.lat, lng: S.lng, label: t.label, students: [t.student], approx: t.approx };
      v.stops.splice(best.k, 0, newStop);
      touched.add(best.vi);
      reroute.add(best.vi); // 기하 변경 → T맵 재계산 필요
    }
  }

  // 인원·정원초과 재계산은 "건드린 차량"만(변동 없는 차량은 그대로 둔다).
  for (const vi of touched) {
    const v = vehicles[vi];
    const passengers = passengersOf(v);
    (v as Record<string, unknown>).passengers = passengers;
    (v as Record<string, unknown>).over = passengers > capacityOf(v);
  }

  return { vehicles, unassigned, reroute: [...reroute].sort((a, b) => a - b) };
}
