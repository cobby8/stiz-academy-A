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
 * 절대 손대지 않는 것(전개로 원본 유지): stops 순서, etaLabel, depotTime/departTime/arriveTime,
 *   path, lat/lng/label, provider/tmapMinutes/tmapKm. 재최적화·시각 재계산을 하지 않는다.
 * 바꾸는 것: 각 정차의 students를 유효 명단으로 필터 → 빈 정차 제거(단 isHub 정차는 유지) → passengers·over 재계산.
 *
 * @param vehicles        저장 payload의 vehicles(Run[] 형태이나 구조만 신뢰).
 * @param validRequestIds 그날 실제로 태울 학생의 shuttleRequestId 집합.
 */
export function reconcileSavedVehicles(vehicles: unknown[], validRequestIds: Set<string>): unknown[] {
  if (!Array.isArray(vehicles)) return [];
  return vehicles.map((v) => {
    const run = (v ?? {}) as ReconcileRun;
    const rawStops = Array.isArray(run.stops) ? (run.stops as unknown[]) : [];

    // 1) 각 정차의 학생을 유효 명단으로 거른다. requestId(=shuttleRequestId)만 매칭한다.
    //    (rosterId/applicationItemId는 폴백모드에서 null이라 불안정하므로 절대 쓰지 않는다.)
    const filteredStops = rawStops.map((s) => {
      const stop = (s ?? {}) as ReconcileStop;
      const students = Array.isArray(stop.students) ? (stop.students as unknown[]) : [];
      const kept = students.filter((st) => {
        const rid = (st as ReconcileStudent)?.requestId;
        return rid != null && validRequestIds.has(String(rid));
      });
      return { ...(s as object), students: kept };
    });

    // 2) 빈 정차 제거 — 단 무료탑승 거점(isHub)은 승객 0명이어도 항상 경유하므로 유지한다.
    const stops = filteredStops.filter((s) => {
      const isHub = (s as ReconcileStop).isHub === true;
      return (s.students as unknown[]).length > 0 || isHub;
    });

    // 3) 인원·정원초과 재계산(순서·시각은 그대로 두고 숫자만 갱신).
    const passengers = stops.reduce((acc, s) => acc + (s.students as unknown[]).length, 0);
    const capacity = typeof run.capacity === "number" ? run.capacity : 0;

    return { ...(v as object), stops, passengers, over: passengers > capacity };
  });
}
