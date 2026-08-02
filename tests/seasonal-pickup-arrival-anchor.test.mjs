import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nodeTimesFromSegments } from "../src/lib/seasonal/shuttle-eta.ts";

// 등원 시간표의 **기준점**을 잠근다.
//   등원(PICKUP)은 "학원 도착 시각"에서 T맵 구간시간을 거꾸로 빼며 역산된다.
//   그 도착 시각은 수업시작 - PICKUP_BUFFER_MIN 이다. 이 상수가 조용히 바뀌면
//   전 요일 전 학생의 탑승 시각이 통째로 어긋나는데, 화면에는 아무 경고도 뜨지 않는다.

const src = readFileSync(new URL("../src/lib/seasonal/shuttle-optimize.ts", import.meta.url), "utf8");

test("등원은 수업 시작 5분 전 학원 도착을 기준으로 역산한다", () => {
  const m = /PICKUP_BUFFER_MIN\s*=\s*(\d+)/.exec(src);
  assert.ok(m, "PICKUP_BUFFER_MIN 상수를 찾지 못했다");
  assert.equal(Number(m[1]), 5, "수업 09:30 기준 학원 도착 09:25");
});

test("도착 기준점이 실제로 '수업시작 - 버퍼'로 쓰인다", () => {
  // 상수만 바꾸고 사용처가 어긋나면 의미가 없으므로 계산식 자체를 확인한다.
  assert.match(src, /direction === "PICKUP" \? \(csMin \?\? 0\) - PICKUP_BUFFER_MIN/);
});

test("역산 결과: 마지막 정차 → 학원 구간이 실제 T맵 시간만큼 벌어진다", () => {
  // 구간: [차고지→A, A→B, B→학원] = 3구간, 2정차.
  // 학원 도착 09:25(565분)에서 거꾸로 빼면
  //   B(마지막 정차) = 565-3 = 562(09:22), A = 562-5 = 557(09:17), 차고지 = 557-6 = 551(09:11).
  const segMinutes = [6, 5, 3];
  const times = nodeTimesFromSegments(segMinutes, "PICKUP", 9 * 60 + 25);
  assert.equal(times[times.length - 1], 9 * 60 + 25, "마지막 노드=학원 도착");
  assert.equal(times[2], 9 * 60 + 22, "마지막 정차는 학원 도착 3분 전");
  assert.equal(times[1], 9 * 60 + 17);
  assert.equal(times[0], 9 * 60 + 11, "차고지 출발까지 역산된다");
});
