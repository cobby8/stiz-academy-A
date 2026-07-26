// 저장된 배차 노선(SeasonalDispatchRoute.payload)의 vehicles 배열을 훑어
// "학생(shuttleRequestId) → 그 정차의 확정 승/하차 시각 라벨"을 뽑아내는 순수 로직.
//
// 왜 별도 파일인가(shuttleStopEta.ts·dispatchReconcile.ts와 같은 이유):
//   dispatchRoute.ts는 prisma 등 서버 의존성을 import하므로 node --test에서 직접 부를 수 없다.
//   "payload를 걸어 requestId별 라벨을 만든다"는 매칭 판정만 이 순수 모듈로 떼어 회귀를 테스트로 못박는다.
//
// 확정 시각의 근거(우선순위):
//   1) 저장 시점에 이미 확정 표시된 문자열 etaLabel(예: "08:53 승차"). 관리자의 수동확정(etaManual)도
//      저장 payload에는 etaLabel로 반영돼 있으므로 이 값이 가장 정확하다.
//   2) etaLabel이 없으면 etaManual(수동확정) → etaMinutes(자동값) 순으로 분을 골라 라벨을 재생성한다.

export type DispatchDirection = "PICKUP" | "DROPOFF";

// 분(자정 기준) → 표시 라벨. shuttleStopEta.etaMinToLabel과 동일 규칙(예: "08:53 승차" / "16:20 하차").
// 순수 모듈을 자기완결형으로 두기 위해(외부 import 0) 여기에 같은 규칙을 둔다.
function etaMinToLabel(min: number, direction: DispatchDirection): string {
  const v = ((Math.round(min) % 1440) + 1440) % 1440;
  const hhmm = `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  return `${hhmm} ${direction === "PICKUP" ? "승차" : "하차"}`;
}

type EtaStudent = { requestId?: string | null };
type EtaStop = {
  students?: EtaStudent[];
  etaLabel?: unknown;
  etaMinutes?: unknown;
  etaManual?: unknown;
};
type EtaVehicle = { stops?: EtaStop[] };

// 확정 시각(분): 수동확정(etaManual)이 있으면 그것, 없으면 자동값(etaMinutes). 둘 다 없으면 null.
// (shuttleStopEta.confirmedEtaMin과 같은 규칙이나, 여기 stop은 lat/lng가 없어 타입만 따로 둔다.)
function confirmedMin(stop: EtaStop): number | null {
  if (typeof stop?.etaManual === "number") return stop.etaManual;
  if (typeof stop?.etaMinutes === "number") return stop.etaMinutes;
  return null;
}

// 한 정차의 확정 라벨. etaLabel 문자열 우선, 없으면 분 → 라벨 재생성.
function stopLabel(stop: EtaStop, direction: DispatchDirection): string | null {
  if (typeof stop?.etaLabel === "string" && stop.etaLabel.trim()) return stop.etaLabel.trim();
  const min = confirmedMin(stop);
  return min != null ? etaMinToLabel(min, direction) : null;
}

/**
 * payload.vehicles를 훑어 requestId → 확정 정차 라벨 맵을 만든다.
 * 같은 requestId가 여러 정차에 나오면(정상적으로는 없음) 먼저 만난 것을 쓴다.
 */
export function extractEtaByRequestId(vehicles: unknown, direction: DispatchDirection): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(vehicles)) return map;
  for (const v of vehicles as EtaVehicle[]) {
    const stops = Array.isArray(v?.stops) ? v.stops : [];
    for (const stop of stops) {
      const label = stopLabel(stop, direction);
      if (!label) continue;
      const students = Array.isArray(stop?.students) ? stop.students : [];
      for (const s of students) {
        const id = s?.requestId;
        if (id != null && String(id) !== "" && !map.has(String(id))) map.set(String(id), label);
      }
    }
  }
  return map;
}
