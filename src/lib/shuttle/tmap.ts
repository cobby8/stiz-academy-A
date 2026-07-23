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

export async function optimizeWaypointOrderWithTmap(input: TmapRouteOptimizationInput): Promise<TmapRouteOptimizationResult> {
  const appKey = process.env.TMAP_APP_KEY?.trim();
  if (!appKey) throw new TmapApiError("TMAP_APP_KEY 환경변수가 설정되지 않았습니다.", 500);
  if (!input.waypoints.length) {
    return { provider: "TMAP", orderedWaypointIds: [], rawSummary: undefined };
  }

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
        ...pointPayload(input.start, "start"),
        ...pointPayload(input.end, "end"),
        viaPoints: input.waypoints.map((point) => ({
          viaPointId: point.id,
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

  const knownIds = new Set(input.waypoints.map((point) => point.id));
  const orderedWaypointIds = collectWaypointIds(body, knownIds);
  if (orderedWaypointIds.length !== input.waypoints.length) {
    throw new TmapApiError("T맵 응답에서 경유지 추천 순서를 확인하지 못했습니다.");
  }

  return {
    provider: "TMAP",
    orderedWaypointIds,
    rawSummary: extractSummary(body),
  };
}
