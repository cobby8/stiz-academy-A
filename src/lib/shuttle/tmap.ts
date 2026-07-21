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

class TmapApiError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
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

  const response = await fetch(routeOptimizationUrl(input.waypoints.length), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      appKey,
    },
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
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new TmapApiError("T맵 경유지 최적화 요청이 실패했습니다.", response.status);
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
