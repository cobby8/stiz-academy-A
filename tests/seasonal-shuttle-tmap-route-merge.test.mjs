import test from "node:test";
import assert from "node:assert/strict";
import { mergeTmapRoute } from "../src/lib/seasonal/tmapRouteMerge.ts";

// 증분 재배차 후 지도가 "직선 추정"으로 퇴화하던 버그의 회귀 방지.
// 핵심 규칙: T맵 성공 시에만 갱신 / 실패 시 이전 실도로 경로 유지 / prev 없으면 종전대로 LOCAL.

const ROAD = [{ lat: 37.6, lng: 127.1 }, { lat: 37.61, lng: 127.11 }];

test("성공 → 새 실도로 경로로 갱신(provider TMAP)", () => {
  const prev = { provider: "LOCAL", tmapMinutes: null, tmapKm: null, path: undefined };
  const out = mergeTmapRoute(prev, { ok: true, tmapMinutes: 20, tmapKm: 8.5, path: ROAD });
  assert.equal(out.provider, "TMAP");
  assert.equal(out.tmapMinutes, 20);
  assert.equal(out.tmapKm, 8.5);
  assert.deepEqual(out.path, ROAD);
});

test("실패 + 이전 실도로 경로 있음 → 그대로 유지(퇴화 방지)", () => {
  // 저장돼 있던 실도로 경로. T맵이 일시 실패해도 이게 사라지면 안 된다.
  const prev = { provider: "TMAP", tmapMinutes: 18, tmapKm: 7.2, path: ROAD };
  const out = mergeTmapRoute(prev, { ok: false });
  assert.equal(out.provider, "TMAP");
  assert.equal(out.tmapMinutes, 18);
  assert.equal(out.tmapKm, 7.2);
  assert.deepEqual(out.path, ROAD); // 실도로 경로 보존
});

test("실패 + prev 없음(신규 run) → 종전대로 LOCAL/무path", () => {
  const prev = { provider: "LOCAL", tmapMinutes: null, tmapKm: null, path: undefined };
  const out = mergeTmapRoute(prev, { ok: false });
  assert.equal(out.provider, "LOCAL");
  assert.equal(out.tmapMinutes, null);
  assert.equal(out.tmapKm, null);
  assert.equal(out.path, undefined);
});

test("성공했지만 경로 좌표가 비어 있으면 path는 undefined로 갱신", () => {
  const prev = { provider: "TMAP", tmapMinutes: 18, tmapKm: 7.2, path: ROAD };
  const out = mergeTmapRoute(prev, { ok: true, tmapMinutes: 22, tmapKm: 9, path: undefined });
  assert.equal(out.provider, "TMAP");
  assert.equal(out.path, undefined); // 성공 결과가 최종값 — 이전 경로로 되돌리지 않는다
});
