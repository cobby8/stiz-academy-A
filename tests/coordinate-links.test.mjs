import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { coordinateLinkSet, coordinatePoint } from "../src/lib/maps/coordinate-links.ts";

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

test("coordinate links reject non-finite and out-of-range positions", () => {
  for (const input of [
    { latitude: 91, longitude: 127, name: "invalid latitude" },
    { latitude: 37, longitude: 181, name: "invalid longitude" },
    { latitude: Number.NaN, longitude: 127, name: "not a number" },
  ]) {
    assert.equal(coordinatePoint(input), null);
    assert.deepEqual(coordinateLinkSet(input), {
      point: null,
      kakaoMap: null,
      kakaoNavigation: null,
      naverNavigation: null,
      tmapNavigation: null,
    });
  }
});

test("coordinate links accept geographic boundary values", () => {
  assert.deepEqual(coordinatePoint({ latitude: "-90", longitude: "180", name: " boundary " }), {
    latitude: -90,
    longitude: 180,
    name: "boundary",
  });
});
