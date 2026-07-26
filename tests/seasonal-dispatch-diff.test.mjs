import test from "node:test";
import assert from "node:assert/strict";
import { diffSavedRoute } from "../src/lib/seasonal/dispatchReconcile.ts";

// 변동 감지(diffSavedRoute)의 회귀 테스트 — Phase 2a.
// 이 함수는 저장 노선(vehicles)과 그날 유효 명단(riders)을 비교해 "추가/위치변경"만 알린다.
// 순수 함수라 node --test에서 바로 돌려 볼 수 있다(DB·별칭 의존성 없음).
//
// 실행: node --test --experimental-strip-types tests/seasonal-dispatch-diff.test.mjs

// 저장 노선 헬퍼: 한 정차에 학생들을 앉힌 vehicle 하나를 만든다.
function vehicle(stops) {
  return { stops };
}
function stop(lat, lng, requestIds) {
  return { lat, lng, students: requestIds.map((rid) => ({ requestId: rid })) };
}
function rider(id, name, lat, lng) {
  return { shuttleRequestId: id, studentName: name, place: { latitude: lat, longitude: lng } };
}

test("added: 저장 노선에 없던 rider는 신규·복귀로 잡힌다", () => {
  const vehicles = [vehicle([stop(37.5, 127.1, ["r1"])])];
  const riders = [rider("r1", "가", 37.5, 127.1), rider("r2", "나", 37.6, 127.2)];
  const { added, locationChanged } = diffSavedRoute(vehicles, riders);
  assert.deepEqual(added, [{ requestId: "r2", name: "나" }]);
  assert.equal(locationChanged.length, 0);
});

test("locationChanged: 저장 좌표와 임계 이상 다르면 위치변경으로 잡힌다", () => {
  const vehicles = [vehicle([stop(37.5, 127.1, ["r1"])])];
  // 위도가 0.001 만큼 이동(임계 1e-5 초과) → 변경.
  const riders = [rider("r1", "가", 37.501, 127.1)];
  const { added, locationChanged } = diffSavedRoute(vehicles, riders);
  assert.equal(added.length, 0);
  assert.deepEqual(locationChanged, [{ requestId: "r1", name: "가" }]);
});

test("임계 이하 미세 오차는 위치변경이 아니다", () => {
  const vehicles = [vehicle([stop(37.5, 127.1, ["r1"])])];
  // 1e-6 차이는 부동소수 오차 범위(임계 1e-5 미만) → 변경 아님.
  const riders = [rider("r1", "가", 37.500001, 127.100001)];
  const { added, locationChanged } = diffSavedRoute(vehicles, riders);
  assert.equal(added.length, 0);
  assert.equal(locationChanged.length, 0);
});

test("rider 좌표가 null이면 위치변경 판정을 스킵한다", () => {
  const vehicles = [vehicle([stop(37.5, 127.1, ["r1"])])];
  const riders = [rider("r1", "가", null, null)];
  const { added, locationChanged } = diffSavedRoute(vehicles, riders);
  assert.equal(added.length, 0);
  assert.equal(locationChanged.length, 0);
});

test("저장 좌표가 null이면 위치변경 판정을 스킵한다", () => {
  const vehicles = [vehicle([stop(null, null, ["r1"])])];
  const riders = [rider("r1", "가", 37.5, 127.1)];
  const { added, locationChanged } = diffSavedRoute(vehicles, riders);
  assert.equal(added.length, 0);
  assert.equal(locationChanged.length, 0);
});

test("변동이 없으면 두 목록 모두 비어 있다", () => {
  const vehicles = [vehicle([stop(37.5, 127.1, ["r1"]), stop(37.6, 127.2, ["r2"])])];
  const riders = [rider("r1", "가", 37.5, 127.1), rider("r2", "나", 37.6, 127.2)];
  const { added, locationChanged } = diffSavedRoute(vehicles, riders);
  assert.equal(added.length, 0);
  assert.equal(locationChanged.length, 0);
});

test("입력을 변형하지 않는다(불변)", () => {
  const vehicles = [vehicle([stop(37.5, 127.1, ["r1"])])];
  const riders = [rider("r2", "나", 37.6, 127.2)];
  const snapV = JSON.stringify(vehicles);
  const snapR = JSON.stringify(riders);
  diffSavedRoute(vehicles, riders);
  assert.equal(JSON.stringify(vehicles), snapV);
  assert.equal(JSON.stringify(riders), snapR);
});

test("requestId만으로 매칭한다(문자/숫자 혼용 안전)", () => {
  const vehicles = [vehicle([stop(37.5, 127.1, [123])])];
  const riders = [rider(123, "가", 37.5, 127.1)];
  const { added, locationChanged } = diffSavedRoute(vehicles, riders);
  assert.equal(added.length, 0);
  assert.equal(locationChanged.length, 0);
});
