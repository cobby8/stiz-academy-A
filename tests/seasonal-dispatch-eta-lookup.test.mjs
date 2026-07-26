// 저장 배차 payload → requestId별 확정 정차 라벨 추출 순수 로직 단위 테스트.
// 대상: src/lib/seasonal/dispatchEtaLookup.ts (extractEtaByRequestId)
import test from "node:test";
import assert from "node:assert/strict";
import { extractEtaByRequestId } from "../src/lib/seasonal/dispatchEtaLookup.ts";

test("etaLabel 문자열이 있으면 그대로, 같은 정차의 모든 학생에 매핑", () => {
  const vehicles = [
    { stops: [
      { etaLabel: "08:53 승차", students: [{ requestId: "a" }, { requestId: "b" }] },
      { etaLabel: "09:10 승차", students: [{ requestId: "c" }] },
    ] },
  ];
  const map = extractEtaByRequestId(vehicles, "PICKUP");
  assert.equal(map.get("a"), "08:53 승차");
  assert.equal(map.get("b"), "08:53 승차");
  assert.equal(map.get("c"), "09:10 승차");
  assert.equal(map.get("z"), undefined);
});

test("etaLabel이 없으면 etaManual(우선) → etaMinutes로 라벨 재생성", () => {
  const vehicles = [
    { stops: [
      { etaMinutes: 500, etaManual: 480, students: [{ requestId: "a" }] }, // 수동확정 우선 → 08:00
      { etaMinutes: 533, students: [{ requestId: "b" }] },                 // 자동값 → 08:53
    ] },
  ];
  const map = extractEtaByRequestId(vehicles, "PICKUP");
  assert.equal(map.get("a"), "08:00 승차");
  assert.equal(map.get("b"), "08:53 승차");
});

test("하원 방향은 '하차' 라벨", () => {
  const vehicles = [{ stops: [{ etaMinutes: 980, students: [{ requestId: "a" }] }] }];
  const map = extractEtaByRequestId(vehicles, "DROPOFF");
  assert.equal(map.get("a"), "16:20 하차");
});

test("시각 정보 없는 정차·빈 학생·잘못된 입력은 조용히 건너뛴다", () => {
  assert.equal(extractEtaByRequestId(null, "PICKUP").size, 0);
  assert.equal(extractEtaByRequestId(undefined, "PICKUP").size, 0);
  const vehicles = [
    { stops: [
      { students: [{ requestId: "a" }] },              // 시각 없음 → 제외
      { etaLabel: "  ", students: [{ requestId: "b" }] }, // 공백 라벨 → 제외
      { etaLabel: "09:00 승차", students: [] },          // 학생 없음 → 매핑 없음
      { etaLabel: "09:30 승차", students: [{ requestId: "" }, { requestId: null }] }, // 빈 id 제외
    ] },
  ];
  const map = extractEtaByRequestId(vehicles, "PICKUP");
  assert.equal(map.size, 0);
});

test("같은 requestId가 여러 정차면 먼저 만난 것을 유지", () => {
  const vehicles = [
    { stops: [
      { etaLabel: "08:00 승차", students: [{ requestId: "a" }] },
      { etaLabel: "09:00 승차", students: [{ requestId: "a" }] },
    ] },
  ];
  const map = extractEtaByRequestId(vehicles, "PICKUP");
  assert.equal(map.get("a"), "08:00 승차");
});
