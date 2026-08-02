// 저장된 배차 노선(payload.vehicles)을 "읽을 때" 그날 유효 명단으로 정합화(reconcile)하는 순수 로직.
//
// 왜 별도 파일인가(shuttleRosterEdit.ts와 같은 이유):
//   dispatchRoute.ts는 "@/lib/prisma" 등 런타임 의존성을 import한다. 그 파일에 로직을 두면
//   node --test에서 직접 import할 수 없어(별칭·DB 초기화) 실제로 돌려 보는 단위 테스트가 불가능하다.
//   그래서 부수효과·의존성이 전혀 없는 이 순수 모듈로 떼어 놓고, dispatchRoute가 이걸 가져다 쓴다.
//
// 이 파일은 shuttle-optimize.ts를 import하지 않는다(그쪽이 dispatchRoute를 import하므로 순환 위험).
// 그래서 Run/Stop/StopStudent 타입을 재사용하지 않고 필요한 최소 구조만 아래에 선언한다.

// payload vehicles 구조 중 reconcile에 필요한 최소 형태. 나머지 필드는 전개(...)로 원본 그대로 보존한다.
type ReconcileStudent = { requestId?: unknown };
type ReconcileStop = { students?: unknown; isHub?: unknown };
type ReconcileRun = { stops?: unknown; capacity?: unknown };

/**
 * 저장된 노선(vehicles)에서 그날 유효하지 않은 학생만 걸러낸다. **순수 함수**(부수효과·DB 접근 없음).
 *
 * 절대 손대지 않는 것(전개로 원본 유지): stops 순서, etaLabel/etaMinutes/etaManual, depotTime/departTime/arriveTime,
 *   path, lat/lng, provider/tmapMinutes/tmapKm. 재최적화·시각 재계산·좌표 변경을 하지 않는다.
 * 바꾸는 것: 각 정차의 students를 유효 명단으로 필터 → 빈 정차 제거(단 isHub 정차는 유지) → passengers·over 재계산.
 *   추가로 labelByRequestId가 주어지면 **표시용 텍스트 라벨만** 현재 명단 라벨로 갱신한다(좌표·경로 무관).
 *   - 살아남은 각 학생의 pickupLabel = 현재 명단 라벨(없으면 기존값 유지).
 *   - 비허브(isHub 아님) 정차의 label = 그 정차 첫 학생의 갱신된 라벨(학생 없으면 기존값 유지).
 *   - isHub 정차 라벨은 절대 갱신하지 않는다(무료거점 고정명 보존).
 *
 * @param vehicles          저장 payload의 vehicles(Run[] 형태이나 구조만 신뢰).
 * @param validRequestIds   그날 유효한 학생(탑승 + 결석 포함)의 shuttleRequestId 집합.
 * @param labelByRequestId  (옵셔널·하위호환) requestId → 현재 명단 라벨. 주어지면 텍스트 라벨만 갱신한다.
 * @param absentIds         오늘 결석(ABSENT/EXCUSED)인 학생의 shuttleRequestId 집합. 제거 대신 isAbsent:true로 마킹한다.
 */
export function reconcileSavedVehicles(
  vehicles: unknown[],
  validRequestIds: Set<string>,
  labelByRequestId?: Map<string, string>,
  absentIds?: Set<string>,
): unknown[] {
  if (!Array.isArray(vehicles)) return [];
  return vehicles.map((v) => {
    const run = (v ?? {}) as ReconcileRun;
    const rawStops = Array.isArray(run.stops) ? (run.stops as unknown[]) : [];

    // 1) 각 정차의 학생을 유효 명단으로 거른다. requestId(=shuttleRequestId)만 매칭한다.
    //    (rosterId/applicationItemId는 폴백모드에서 null이라 불안정하므로 절대 쓰지 않는다.)
    const filteredStops = rawStops.map((s) => {
      const stop = (s ?? {}) as ReconcileStop;
      const isHub = stop.isHub === true;
      const students = Array.isArray(stop.students) ? (stop.students as unknown[]) : [];
      const kept = students
        .filter((st) => {
          const rid = (st as ReconcileStudent)?.requestId;
          return rid != null && validRequestIds.has(String(rid));
        })
        .map((st) => {
          const rid = (st as ReconcileStudent)?.requestId;
          const ridStr = rid != null ? String(rid) : null;
          // 라벨 갱신: 순수 표시용 텍스트만 현재 명단 라벨로 바꾼다(좌표·시각·순서 무관).
          const next = labelByRequestId && ridStr != null ? labelByRequestId.get(ridStr) : undefined;
          // ⚠️ isAbsent는 "그날 하루"의 파생값이지 저장값이 아니다. 저장본에 남아 있을 수 있는
          //    과거 플래그를 반드시 **먼저 떼고**, 오늘 기준으로만 다시 붙인다.
          //    (붙이기만 하고 떼지 않으면 결석이 노선에 영구 각인돼 다음 주에도 결석으로 뜬다.)
          const { isAbsent: _stale, ...rest } = (st ?? {}) as Record<string, unknown>;
          const cleaned = next != null ? { ...rest, pickupLabel: next } : rest;
          const isAbsentToday = ridStr != null && absentIds != null && absentIds.has(ridStr);
          return isAbsentToday ? { ...cleaned, isAbsent: true } : cleaned;
        });

      // 비허브 정차의 표시 라벨을 첫 학생의 갱신된 라벨로 맞춘다. 허브는 고정명 보존이라 건드리지 않는다.
      if (labelByRequestId && !isHub && kept.length > 0) {
        const firstRid = (kept[0] as ReconcileStudent)?.requestId;
        const nextLabel = firstRid != null ? labelByRequestId.get(String(firstRid)) : undefined;
        if (nextLabel != null) return { ...(s as object), students: kept, label: nextLabel };
      }
      return { ...(s as object), students: kept };
    });

    // 2) 빈 정차 제거 — 취소·퇴원으로 학생이 0명이 된 정차만 뺀다.
    //    결석자만 남은 정차는 유지한다(결석은 노선을 변형하지 않는다 — 기사 현장 판단).
    const stops = filteredStops.filter((s) => (s.students as unknown[]).length > 0);

    // 3) 인원·정원초과 재계산 — 노선에 편성된 **전원**을 센다(결석자 포함).
    //    노선표의 인원수는 "이 노선에 배정된 좌석 수"이지 "오늘 실제로 탄 수"가 아니다.
    //    결석·자차등원은 기사 운행표와 출석부에서만 다룬다(사용자 확정 원칙).
    const passengers = stops.reduce((acc, s) => acc + (s.students as unknown[]).length, 0);
    const capacity = typeof run.capacity === "number" ? run.capacity : 0;

    // 4) **정차가 실제로 사라졌을 때만** 저장된 T맵 경로(path)를 무효화한다.
    //    정차가 그대로면 지나가는 지점이 같으므로 경로는 여전히 유효하다 —
    //    한 정차의 5명 중 1명만 취소된 경우까지 경로를 날리면 T맵을 헛되이 다시 부른다.
    //    결석자는 애초에 제거되지 않으므로 이 조건에 걸리지 않는다(경로 보존).
    const geometryChanged = stops.length !== rawStops.length;
    const base = { ...(v as object), stops, passengers, over: passengers > capacity };
    if (geometryChanged) (base as Record<string, unknown>).path = undefined;
    return base;
  });
}

// ────────────────────────────────────────────────────────────────
// 변동 감지(diff) — reconcile와 반대 방향. "제거"가 아니라 "추가/변경"을 **알림만** 한다.
// ────────────────────────────────────────────────────────────────

// diff에 필요한 최소 형태만 선언한다. reconcile 쪽 타입과 겹치지 않게 별도로 둔다.
type DiffStudent = { requestId?: unknown };
type DiffStop = { students?: unknown; lat?: unknown; lng?: unknown };
type DiffRun = { stops?: unknown };
type DiffRiderPlace = { latitude?: unknown; longitude?: unknown } | null | undefined;
type DiffRider = { shuttleRequestId?: unknown; studentName?: unknown; place?: DiffRiderPlace };

/** 좌표 임계값 — 부동소수 저장/역직렬화 오차를 넘어서는 "진짜 이동"만 변경으로 본다. */
const COORD_EPSILON = 1e-5;

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 저장된 노선(vehicles)과 그날 유효 명단(riders)을 비교해 **변동만** 골라낸다. **순수 함수**(부수효과 없음).
 *
 * 저장 payload·순서·시각·좌표는 절대 건드리지 않는다(읽기 진단만). 반환값도 이름/id 요약뿐이다.
 *
 * @returns
 *   added           = riders 중 저장 노선에 아예 없는 사람(신규·복귀).
 *   locationChanged = 저장 노선에는 있으나, 그 학생이 앉은 정차 좌표가 지금 좌표와 임계 이상 다른 사람.
 *                     rider 좌표가 null이면(위치 미확정) 판정 불가라 스킵한다.
 *
 * requestId(=shuttleRequestId)만으로 매칭한다(rosterId/applicationItemId는 폴백에서 null이라 불안정).
 */
export function diffSavedRoute(
  vehicles: unknown[],
  riders: DiffRider[],
): { added: { requestId: string; name: string }[]; locationChanged: { requestId: string; name: string }[] } {
  const savedIds = new Set<string>();
  // requestId → 그 학생이 앉아 있는 정차의 좌표. 같은 학생이 여러 번 나오는 비정상 상황이면 첫 좌표를 쓴다.
  const savedCoord = new Map<string, { lat: number | null; lng: number | null }>();

  if (Array.isArray(vehicles)) {
    for (const v of vehicles) {
      const stops = Array.isArray((v as DiffRun)?.stops) ? ((v as DiffRun).stops as unknown[]) : [];
      for (const s of stops) {
        const stop = (s ?? {}) as DiffStop;
        const students = Array.isArray(stop.students) ? (stop.students as unknown[]) : [];
        for (const st of students) {
          const rid = (st as DiffStudent)?.requestId;
          if (rid == null) continue;
          const key = String(rid);
          savedIds.add(key);
          if (!savedCoord.has(key)) savedCoord.set(key, { lat: toNum(stop.lat), lng: toNum(stop.lng) });
        }
      }
    }
  }

  const added: { requestId: string; name: string }[] = [];
  const locationChanged: { requestId: string; name: string }[] = [];

  for (const rider of riders ?? []) {
    const rid = rider?.shuttleRequestId;
    if (rid == null) continue;
    const key = String(rid);
    const name = String(rider?.studentName ?? "");

    // 신규·복귀 — 저장 노선에 없던 사람.
    if (!savedIds.has(key)) {
      added.push({ requestId: key, name });
      continue;
    }

    // 위치변경 — 저장 좌표와 지금 좌표를 비교한다. 한쪽이라도 좌표가 없으면 판정하지 않는다.
    const now = { lat: toNum(rider?.place?.latitude), lng: toNum(rider?.place?.longitude) };
    if (now.lat == null || now.lng == null) continue;
    const saved = savedCoord.get(key);
    if (!saved || saved.lat == null || saved.lng == null) continue;
    if (Math.abs(saved.lat - now.lat) > COORD_EPSILON || Math.abs(saved.lng - now.lng) > COORD_EPSILON) {
      locationChanged.push({ requestId: key, name });
    }
  }

  return { added, locationChanged };
}
