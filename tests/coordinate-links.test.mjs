import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const coordinateLinksSource = await readFile("src/lib/maps/coordinate-links.ts", "utf8");
const adminShuttleSource = await readFile("src/app/admin/shuttle/ShuttleRouteAdminClient.tsx", "utf8");

test("map links are generated from coordinates instead of address text", () => {
  assert.match(coordinateLinksSource, /coordinatePoint/);
  assert.match(coordinateLinksSource, /latitude/);
  assert.match(coordinateLinksSource, /longitude/);
  assert.match(coordinateLinksSource, /goalx=\$\{point\.longitude\}/);
  assert.match(coordinateLinksSource, /goaly=\$\{point\.latitude\}/);
  assert.match(coordinateLinksSource, /map\.kakao\.com\/link\/map/);
  assert.match(coordinateLinksSource, /map\.kakao\.com\/link\/to/);
});

test("admin shuttle screen opens confirmed pins with coordinate links", () => {
  assert.match(adminShuttleSource, /coordinateLinkSet/);
  assert.match(adminShuttleSource, /links\.kakaoMap/);
  assert.match(adminShuttleSource, /links\.tmapNavigation/);
  assert.match(adminShuttleSource, /T맵 길안내/);
});
