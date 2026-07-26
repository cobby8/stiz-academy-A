export type TmapWaypoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type TmapRouteOptimizationInput = {
  start: TmapWaypoint;
  end: TmapWaypoint;
  waypoints: TmapWaypoint[];
};

export type TmapRouteOptimizationResult = {
  provider: "TMAP";
  orderedWaypointIds: string[];
  rawSummary?: {
    totalDistance?: number;
    totalTime?: number;
  };
};

export class TmapApiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly code = "TMAP_API_ERROR",
  ) {
    super(message);
    this.name = "TmapApiError";
  }
}

const TMAP_REQUEST_TIMEOUT_MS = 10_000;

function isTimeoutError(error: unknown) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function productLimit(count: number) {
  if (count <= 10) return 10;
  if (count <= 20) return 20;
  if (count <= 30) return 30;
  return 100;
}

function routeOptimizationUrl(waypointCount: number) {
  const override = process.env.TMAP_ROUTE_OPTIMIZATION_URL?.trim();
  if (override) return override;
  const limit = productLimit(waypointCount);
  return `https://apis.openapi.sk.com/tmap/routes/routeOptimization${limit}?version=1&format=json`;
}

function pointPayload(point: TmapWaypoint, prefix: "start" | "end") {
  return {
    [`${prefix}Name`]: point.name,
    [`${prefix}X`]: String(point.longitude),
    [`${prefix}Y`]: String(point.latitude),
  };
}

function collectWaypointIds(value: unknown, knownIds: Set<string>, output: string[] = []) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) collectWaypointIds(item, knownIds, output);
    return output;
  }
  const row = value as Record<string, unknown>;
  const candidate = row.viaPointId ?? row.viaId ?? row.id;
  if (candidate !== undefined) {
    const id = String(candidate);
    if (knownIds.has(id) && !output.includes(id)) output.push(id);
  }
  for (const item of Object.values(row)) collectWaypointIds(item, knownIds, output);
  return output;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractSummary(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Record<string, unknown>;
  const properties = data.properties && typeof data.properties === "object" ? data.properties as Record<string, unknown> : {};
  return {
    totalDistance: numberValue(data.totalDistance ?? properties.totalDistance),
    totalTime: numberValue(data.totalTime ?? properties.totalTime),
  };
}

// T맵 경유지 최적화는 startTime(출발 예정시각, yyyyMMddHHmm)이 필수다. 없으면 400(9401)로 거절된다.
// 교통량 예측 기준 시각일 뿐이라 현재 시각(학원 시간대)을 넣는다.
function tmapStartTime(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}${g("month")}${g("day")}${g("hour")}${g("minute")}`;
}

export async function optimizeWaypointOrderWithTmap(input: TmapRouteOptimizationInput): Promise<TmapRouteOptimizationResult> {
  const appKey = process.env.TMAP_APP_KEY?.trim();
  if (!appKey) throw new TmapApiError("TMAP_APP_KEY 환경변수가 설정되지 않았습니다.", 500);
  if (!input.waypoints.length) {
    return { provider: "TMAP", orderedWaypointIds: [], rawSummary: undefined };
  }

  // ⚠️ T맵은 viaPointId "0"을 "값 없음"으로 취급해 400(9401)을 낸다(호출부가 인덱스 0을 쓰면 항상 실패).
  //    내부용 안전 id(wpN)로 바꿔 보내고, 응답 순서를 호출부가 준 원래 id로 되돌린다.
  const originalBySafe = new Map<string, string>();
  const safeById = new Map<string, string>();
  input.waypoints.forEach((point, index) => {
    const safe = `wp${index}`;
    originalBySafe.set(safe, point.id);
    safeById.set(point.id, safe);
  });

  let response: Response;
  let body: unknown = null;
  try {
    response = await fetch(routeOptimizationUrl(input.waypoints.length), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        appKey,
      },
      signal: AbortSignal.timeout(TMAP_REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        reqCoordType: "WGS84GEO",
        resCoordType: "WGS84GEO",
        startTime: tmapStartTime(),
        ...pointPayload(input.start, "start"),
        ...pointPayload(input.end, "end"),
        viaPoints: input.waypoints.map((point) => ({
          viaPointId: safeById.get(point.id),
          viaPointName: point.name,
          viaX: String(point.longitude),
          viaY: String(point.latitude),
        })),
      }),
    });
    body = await response.json().catch((error: unknown) => {
      // fetch에 전달한 신호는 응답 본문을 읽는 동안에도 유효합니다.
      // 시간 초과는 바깥 catch에서 504로 변환하고, 잘못된 JSON만 기존처럼 빈 응답으로 처리합니다.
      if (isTimeoutError(error)) throw error;
      return null;
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new TmapApiError(
        "T맵 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
        504,
        "TMAP_OPTIMIZATION_TIMEOUT",
      );
    }
    throw new TmapApiError("T맵 경유지 최적화 요청에 연결하지 못했습니다.");
  }
  if (!response.ok) {
    throw new TmapApiError("T맵 경유지 최적화 요청이 실패했습니다.");
  }

  const knownSafeIds = new Set(originalBySafe.keys());
  const orderedSafeIds = collectWaypointIds(body, knownSafeIds);
  if (orderedSafeIds.length !== input.waypoints.length) {
    throw new TmapApiError("T맵 응답에서 경유지 추천 순서를 확인하지 못했습니다.");
  }

  return {
    provider: "TMAP",
    // 내부 안전 id → 호출부가 준 원래 id로 되돌린다.
    orderedWaypointIds: orderedSafeIds.map((safe) => originalBySafe.get(safe) as string),
    rawSummary: extractSummary(body),
  };
}
