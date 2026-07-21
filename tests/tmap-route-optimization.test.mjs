import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tmapSource = await readFile("src/lib/shuttle/tmap.ts", "utf8");
const serviceSource = await readFile("src/lib/shuttle/service.ts", "utf8");
const adminApiSource = await readFile("src/app/api/admin/shuttle/route.ts", "utf8");
const adminClientSource = await readFile("src/app/admin/shuttle/ShuttleRouteAdminClient.tsx", "utf8");

test("tmap optimization uses server-only app key and coordinate waypoints", () => {
  assert.match(tmapSource, /process\.env\.TMAP_APP_KEY/);
  assert.doesNotMatch(tmapSource, /NEXT_PUBLIC_TMAP/);
  assert.match(tmapSource, /routeOptimization\$\{limit\}/);
  assert.match(tmapSource, /appKey/);
  assert.match(tmapSource, /reqCoordType: "WGS84GEO"/);
  assert.match(tmapSource, /\[\`\$\{prefix\}X`\]: String\(point\.longitude\)/);
  assert.match(tmapSource, /\[\`\$\{prefix\}Y`\]: String\(point\.latitude\)/);
  assert.match(tmapSource, /viaX/);
  assert.match(tmapSource, /viaY/);
});

test("admin shuttle API exposes tmap preview without directly mutating route order", () => {
  assert.match(serviceSource, /previewOptimizedRouteStops/);
  assert.match(serviceSource, /optimizeWaypointOrderWithTmap/);
  assert.match(serviceSource, /ROUTE_ENDPOINTS_REQUIRED/);
  assert.match(adminApiSource, /optimizePreview/);
  assert.match(adminApiSource, /NextResponse\.json\(\{ preview:/);
});

test("admin shuttle screen can preview and then apply recommended stop order", () => {
  assert.match(adminClientSource, /OptimizationPreview/);
  assert.match(adminClientSource, /previewOptimizedStops/);
  assert.match(adminClientSource, /applyOptimizedStops/);
  assert.match(adminClientSource, /T맵 순서 추천/);
  assert.match(adminClientSource, /추천 순서 적용/);
  assert.match(adminClientSource, /action: "optimizePreview"/);
  assert.match(adminClientSource, /action: "reorder"/);
});
