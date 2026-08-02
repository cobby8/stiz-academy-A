import test from "node:test";
import assert from "node:assert/strict";
import { isSamePlace, findSamePlaceIndex, distanceMeters, SAME_PLACE_METERS } from "../src/lib/seasonal/stopMerge.ts";

// 정차 병합 기준(같은 장소 판정)을 실제로 돌려 검사한다.
//
// 2026-08-03 운영 사고 재현: 롯데낙천대아파트 관리사무소 앞에 타는 두 학생이
// 등원 노선에서 정차 2개로 갈라져 기사님이 같은 곳을 두 번 들르게 돼 있었다.
// 아래 좌표는 그때 DB에 실제로 저장돼 있던 값이다.
const 이수연 = { lat: 37.60774726496066, lng: 127.1527210231168 };
const 김하임 = { lat: 37.60773488372487, lng: 127.1527153351801 };

test("실제 사고 좌표: 같은 아파트 두 학생은 같은 정차로 합쳐진다", () => {
  const d = distanceMeters(이수연.lat, 이수연.lng, 김하임.lat, 김하임.lng);
  assert.ok(d < 3, `두 지점은 사실상 같은 자리여야 한다(실측 ${d.toFixed(2)}m)`);
  assert.equal(isSamePlace(이수연.lat, 이수연.lng, 김하임.lat, 김하임.lng), true);
});

test("옛 기준(±1e-5 축별 비교)이었다면 갈라졌다는 사실을 명시한다(회귀 방지)", () => {
  // 위도 차이가 1e-5를 넘는다 → 예전 RouteSection/dispatchIncrement 기준으로는 '다른 장소'였다.
  const dLat = Math.abs(이수연.lat - 김하임.lat);
  assert.ok(dLat > 1e-5, "이 케이스가 옛 기준을 통과해 버리면 회귀 테스트로서 의미가 없다");
  // 그럼에도 새 기준으로는 같은 장소여야 한다.
  assert.equal(isSamePlace(이수연.lat, 이수연.lng, 김하임.lat, 김하임.lng), true);
});

test("격자(toFixed) 방식의 경계 문제를 겪지 않는다", () => {
  // toFixed(4) 격자에서는 37.60774 → "37.6077", 37.60775 → "37.6078"로 갈라진다(약 1m인데도).
  const a = { lat: 37.60774, lng: 127.15271 };
  const b = { lat: 37.60775, lng: 127.15271 };
  assert.notEqual(a.lat.toFixed(4), b.lat.toFixed(4), "격자 경계에 걸친 좌표 쌍이 맞는지 확인");
  assert.equal(isSamePlace(a.lat, a.lng, b.lat, b.lng), true, "거리 기준이면 같은 장소로 본다");
});

test("멀리 떨어진 곳은 합치지 않는다", () => {
  // 반도유보라 맘스테이션 ↔ 롯데낙천대(약 2.5km) — 명백히 다른 정차.
  assert.equal(isSamePlace(37.62997717837093, 127.1550747059319, 이수연.lat, 이수연.lng), false);
});

test(`경계값: ${SAME_PLACE_METERS}m 안쪽은 합치고 바깥은 합치지 않는다`, () => {
  const base = { lat: 37.6, lng: 127.15 };
  // 위도 1도 ≈ 111,320m → 20m ≈ 1.797e-4, 50m ≈ 4.492e-4
  const near = { lat: base.lat + 20 / 111320, lng: base.lng };
  const far = { lat: base.lat + 50 / 111320, lng: base.lng };
  assert.equal(isSamePlace(base.lat, base.lng, near.lat, near.lng), true, "20m는 같은 장소");
  assert.equal(isSamePlace(base.lat, base.lng, far.lat, far.lng), false, "50m는 다른 장소");
});

test("findSamePlaceIndex: 가장 가까운 정차를 고른다", () => {
  const stops = [
    { lat: 37.60, lng: 127.10 },                    // 멀리
    { lat: 이수연.lat + 0.0002, lng: 이수연.lng },   // 약 22m
    { lat: 김하임.lat, lng: 김하임.lng },            // 약 1.4m ← 가장 가까움
  ];
  assert.equal(findSamePlaceIndex(stops, 이수연.lat, 이수연.lng), 2);
});

test("findSamePlaceIndex: 좌표가 없으면 병합하지 않는다(-1)", () => {
  const stops = [{ lat: 이수연.lat, lng: 이수연.lng }];
  assert.equal(findSamePlaceIndex(stops, null, null), -1);
  assert.equal(findSamePlaceIndex(stops, undefined, 127.15), -1);
  // 정차 쪽 좌표가 비어 있어도 건너뛴다(무료거점은 좌표가 없을 수 있다).
  assert.equal(findSamePlaceIndex([{ lat: null, lng: null }], 이수연.lat, 이수연.lng), -1);
});
