// 정차별 '수동 확정 시각'(etaManual) 오버레이 순수 로직(외부 의존성 없음 → 단위 테스트 대상).
//
// 배경(T2): 각 정차는 T1에서 T맵 구간시간 기반 자동값 etaMinutes(자정기준 분)를 갖는다.
//   관리자가 특정 정차 시각을 손으로 고치면 그 값을 etaManual에 '확정값'으로 박아 둔다.
//   이후 자동제안/증분재배차/순서변경/출발시각 shift 로 시각을 다시 계산해도, etaManual이
//   설정된 정차는 그 값을 유지해야 한다(자동값으로 덮지 않는다).
//
// 왜 별도 파일인가(dispatchReconcile.ts와 같은 이유): shuttle-optimize.ts는 prisma 등 서버
//   의존성을 import하므로 node --test에서 직접 부를 수 없다. "재계산 결과에 기존 etaManual을
//   키 매칭으로 재적용" 하는 판정만 이 순수 모듈로 떼어 회귀를 테스트로 못박는다.

export type DispatchDirection = "PICKUP" | "DROPOFF";

// 오버레이에 필요한 최소 구조. 나머지 필드는 전개(...)로 원본 그대로 보존한다.
export type ManualEtaStop = {
  lat: number;
  lng: number;
  students?: { requestId?: string | null }[];
  etaLabel?: string;
  etaMinutes?: number;      // 자동 계산값(자정 기준 분)
  etaManual?: number | null; // 수동 확정값(있으면 이게 표시·저장 기준)
};

// 확정 시각(분): 수동 확정값(etaManual)이 있으면 그것, 없으면 자동값(etaMinutes). 둘 다 없으면 null.
export function confirmedEtaMin(stop: ManualEtaStop): number | null {
  if (stop.etaManual != null) return stop.etaManual;
  if (stop.etaMinutes != null) return stop.etaMinutes;
  return null;
}

// 표시용 라벨. 예) "08:53 승차" / "16:20 하차". (RouteSection의 fmtHHMM과 동일 규칙)
export function etaMinToLabel(min: number, direction: DispatchDirection): string {
  const v = ((Math.round(min) % 1440) + 1440) % 1440;
  const hhmm = `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  return `${hhmm} ${direction === "PICKUP" ? "승차" : "하차"}`;
}

// 정차 식별 키 — 재계산 전/후 stop을 안정적으로 매칭한다.
//   1순위: 그 정차에 탄 학생 requestId 집합(정렬). 정차 = 승객 묶음이므로 순서·좌표가 바뀌어도 같은 사람 묶음이면 같은 키.
//   폴백: 승객이 없으면(무료탑승 거점 등) 좌표(소수 5자리 반올림 ≒ 1e-5).
export function stopKey(stop: ManualEtaStop): string {
  const ids = (stop.students ?? [])
    .map((s) => s?.requestId)
    .filter((r): r is string => r != null && r !== "")
    .sort();
  if (ids.length) return `r:${ids.join(",")}`;
  return `c:${stop.lat.toFixed(5)},${stop.lng.toFixed(5)}`;
}

// 재계산된 stops(newStops)에 기존 stops(priorStops)의 etaManual을 키 매칭으로 다시 붙인다.
//   - 매칭되고 prior에 etaManual이 있으면: etaManual 유지 + etaLabel을 확정값으로 재생성(자동값으로 덮지 않음).
//   - 매칭 안 되거나 prior에 etaManual이 없으면: 자동값 그대로 두고 etaManual은 제거(리셋된 상태).
// newStops는 얕게 복제해 반환한다(입력 불변).
export function reapplyManualEta<T extends ManualEtaStop>(
  newStops: T[],
  priorStops: ManualEtaStop[],
  direction: DispatchDirection,
): T[] {
  const manualByKey = new Map<string, number>();
  for (const s of priorStops) {
    if (s.etaManual != null) manualByKey.set(stopKey(s), s.etaManual);
  }
  return newStops.map((s) => {
    const m = manualByKey.get(stopKey(s));
    if (m != null) {
      // 확정값 유지 — 자동값(etaMinutes)은 그대로 두고 표시만 확정값으로.
      return { ...s, etaManual: m, etaLabel: etaMinToLabel(m, direction) };
    }
    // 자동값 — etaManual을 명시적으로 떨어뜨린다(prior에 있었으나 리셋됐거나 원래 없던 경우 모두 자동으로 복귀).
    const { etaManual: _drop, ...rest } = s;
    return rest as T;
  });
}

// 차량 배열 단위 오버레이. prior의 모든 정차를 한 맵으로 모아 키 매칭하므로 차량이 갈려도 같은 승객 묶음이면 유지된다.
export function reapplyManualEtaVehicles<V extends { stops: ManualEtaStop[] }>(
  newVehicles: V[],
  priorVehicles: { stops: ManualEtaStop[] }[],
  direction: DispatchDirection,
): V[] {
  const priorStops = priorVehicles.flatMap((v) => v.stops ?? []);
  return newVehicles.map((v) => ({ ...v, stops: reapplyManualEta(v.stops, priorStops, direction) }));
}
