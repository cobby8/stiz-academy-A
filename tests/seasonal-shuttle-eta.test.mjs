import test from "node:test";
import assert from "node:assert/strict";
import { segmentMinutes, nodeTimesFromSegments } from "../src/lib/seasonal/shuttle-eta.ts";

// 셔틀 정차별 ETA 누적 로직(순수 함수) 회귀 테스트.
// planRun이 T맵 '구간별 실제 시간'으로 stop ETA를 계산할 때 쓰는 두 함수를 직접 검증한다.
// (네트워크 T맵 호출은 모킹이 어려워 제외 — 누적/역산/폴백 로직만 못박는다.)

// ── segmentMinutes: 구간 초→분, 실패 구간은 fallback 대체 ─────────────
test("전 구간 성공: 초를 분으로 변환한다", () => {
  const out = segmentMinutes([60, 120, 300], [99, 99, 99]);
  assert.deepEqual(out, [1, 2, 5]);
});

test("일부 구간 실패(null): 그 구간만 fallback으로 대체한다", () => {
  // 2번째 구간만 실패 → fallbackMin[1]=7 사용, 나머지는 실측(초/60).
  const out = segmentMinutes([60, null, 300], [5, 7, 9]);
  assert.deepEqual(out, [1, 7, 5]);
});

test("0 이하도 실패로 보고 fallback을 쓴다", () => {
  const out = segmentMinutes([0, -5, 120], [4, 6, 99]);
  assert.deepEqual(out, [4, 6, 2]);
});

test("전 구간 실패: 전부 fallback(직선추정)으로 채운다", () => {
  const out = segmentMinutes([null, null], [10, 20]);
  assert.deepEqual(out, [10, 20]);
});

// ── nodeTimesFromSegments: 방향별 누적 ───────────────────────────────
// 노드 = [출발, ...정차, 도착], 노드수 = 구간수+1.
test("DROPOFF(하원): 학원 출발 기준 순방향 누적", () => {
  // 학원 출발 600분(10:00), 구간 [5,10,15]분 → 정차 605, 615, 도착 630.
  const t = nodeTimesFromSegments([5, 10, 15], "DROPOFF", 600);
  assert.deepEqual(t, [600, 605, 615, 630]);
});

test("PICKUP(등원): 학원 도착 기준 역산", () => {
  // 학원 도착 630분, 구간 [5,10,15]분 → 뒤에서 앞으로: 도착630, 정차615, 605, 출발600.
  const t = nodeTimesFromSegments([5, 10, 15], "PICKUP", 630);
  assert.deepEqual(t, [600, 605, 615, 630]);
});

test("정차 1개(구간 2개)도 방향별로 맞는다", () => {
  assert.deepEqual(nodeTimesFromSegments([8, 12], "DROPOFF", 500), [500, 508, 520]);
  assert.deepEqual(nodeTimesFromSegments([8, 12], "PICKUP", 520), [500, 508, 520]);
});

// ── 결합: 부분 실패 구간을 fallback으로 메운 뒤 누적해도 시각이 비지 않는다 ──
test("일부 실패를 fallback으로 메우고 역산해도 ETA가 연속이다", () => {
  const segMinutes = segmentMinutes([120, null, 180], [3, 4, 6]); // → [2, 4, 3]
  const t = nodeTimesFromSegments(segMinutes, "PICKUP", 700); // 도착 700
  // 700 - 3 = 697 - 4 = ... 역산: [700-2-4-3, 700-4-3, 700-3, 700] = [691, 693, 697, 700]
  assert.deepEqual(t, [691, 693, 697, 700]);
});
