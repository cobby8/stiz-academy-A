import test from "node:test";
import assert from "node:assert/strict";
import { planIncrementalInsert, haversineKm } from "../src/lib/seasonal/dispatchIncrement.ts";

// 증분 재배차(cheapest-insertion) 순수 로직을 **실제로 돌려 보고** 검사한다.
//
// 핵심 계약:
//   1) 기존 정차 상호 순서 보존(삽입만, 재배열 금지)
//   2) 차량 선택 = 정원 여유 + 삽입 추가비용 최소
//   3) 동좌표(±1e-5) 병합(새 정차 X)
//   4) 정원 초과 금지 → unassigned
//   5) 위치변경 = 기존 제거 후 재삽입

// 좌표 헬퍼(서울 근방, 대략 동/서 배치).
const START = { lat: 37.60, lng: 127.10 };
const END = { lat: 37.61, lng: 127.15 };
const GEO = { start: START, end: END };

function stop(lat, lng, students, extra = {}) {
  return { lat, lng, label: `${lat},${lng}`, approx: false, students, ...extra };
}
function stu(requestId, name = requestId) {
  return { requestId, name, rosterId: null, grade: null, parentPhone: null, childPhone: null, pickupLabel: name };
}
function vehicle(stops, capacity = 9, extra = {}) {
  return { index: 1, vehicleName: "1호차", capacity, stops, passengers: stops.reduce((a, s) => a + s.students.length, 0), over: false, provider: "TMAP", tmapMinutes: 10, path: [{ lat: 1, lng: 1 }], ...extra };
}
function target(requestId, lat, lng, opts = {}) {
  return { requestId, student: stu(requestId), name: requestId, lat, lng, label: requestId, approx: false, isHub: false, ...opts };
}
function labelsOf(v) { return v.stops.map((s) => s.label); }

test("신규 학생을 정원 여유 차량에 삽입한다", () => {
  const v = vehicle([stop(37.601, 127.101, [stu("A")]), stop(37.602, 127.102, [stu("B")])]);
  const r = planIncrementalInsert([v], [target("NEW", 37.603, 127.103)], GEO);
  const veh = r.vehicles[0];
  const ids = veh.stops.flatMap((s) => s.students.map((x) => x.requestId));
  assert.ok(ids.includes("NEW"), "신규가 배차되어야 함");
  assert.equal(r.unassigned.length, 0);
  assert.ok(r.reroute.includes(0), "기하 변경 → reroute 대상");
  assert.equal(veh.passengers, 3, "인원 재계산");
});

test("기존 정차 상호 순서를 재배열하지 않는다(삽입만)", () => {
  // 일부러 최적이 아닌 순서(B가 A보다 start에서 멀지만 먼저)를 준다.
  const A = stop(37.6005, 127.1005, [stu("A")]);
  const B = stop(37.6090, 127.1490, [stu("B")]);
  const v = vehicle([A, B]);
  const r = planIncrementalInsert([v], [target("NEW", 37.605, 127.125)], GEO);
  const labels = labelsOf(r.vehicles[0]).filter((l) => l !== "NEW");
  // A, B의 상대 순서(A 먼저, B 나중)가 그대로여야 한다.
  assert.deepEqual(labels, [A.label, B.label], "기존 정차 순서 보존");
});

test("cheapest-insertion: 가장 가까운 인접쌍 사이에 넣는다", () => {
  // start(서쪽) - A(서) - B(동) - end(동). 신규 P를 A와 B 사이 값으로 두면 그 사이에 들어가야.
  const A = stop(37.600, 127.105, [stu("A")]);
  const B = stop(37.608, 127.145, [stu("B")]);
  const v = vehicle([A, B]);
  const r = planIncrementalInsert([v], [target("P", 37.604, 127.125)], GEO);
  const labels = labelsOf(r.vehicles[0]);
  const idxA = labels.indexOf(A.label), idxP = labels.indexOf("P"), idxB = labels.indexOf(B.label);
  assert.ok(idxA < idxP && idxP < idxB, `A-P-B 순으로 삽입되어야 함(실제: ${labels.join(",")})`);
});

test("동좌표(±1e-5) 기존 정차에 병합 — 새 정차를 만들지 않는다", () => {
  const A = stop(37.6005, 127.1005, [stu("A")]);
  const v = vehicle([A]);
  const before = v.stops.length;
  const r = planIncrementalInsert([v], [target("SAME", 37.6005 + 5e-6, 127.1005 - 5e-6)], GEO);
  const veh = r.vehicles[0];
  assert.equal(veh.stops.length, before, "정차 개수 불변(병합)");
  assert.equal(veh.stops[0].students.length, 2, "같은 정차에 학생 추가");
  assert.equal(r.reroute.length, 0, "기하 불변 → reroute 없음");
  assert.equal(veh.passengers, 2);
});

test("정원 초과 금지 → unassigned로 남긴다", () => {
  const v = vehicle([stop(37.601, 127.101, [stu("A"), stu("B")])], 2); // capacity 2, 이미 2명(만차)
  const r = planIncrementalInsert([v], [target("OVER", 37.603, 127.103)], GEO);
  assert.equal(r.unassigned.length, 1);
  assert.equal(r.unassigned[0].name, "OVER");
  assert.equal(r.vehicles[0].passengers, 2, "만차 차량 인원 불변");
});

test("여러 차량 중 삽입 추가비용이 작은 차량을 고른다", () => {
  // v0의 정차는 신규 P와 가깝고, v1은 멀다. P는 v0에 들어가야.
  const v0 = vehicle([stop(37.604, 127.124, [stu("A")])], 9, { index: 1 });
  const v1 = vehicle([stop(37.500, 127.000, [stu("B")])], 9, { index: 2 });
  const r = planIncrementalInsert([v0, v1], [target("P", 37.605, 127.125)], GEO);
  const in0 = r.vehicles[0].stops.some((s) => s.students.some((x) => x.requestId === "P"));
  const in1 = r.vehicles[1].stops.some((s) => s.students.some((x) => x.requestId === "P"));
  assert.ok(in0 && !in1, "가까운 차량(v0)에 배차");
});

test("만차 차량은 건너뛰고 여유 차량에 넣는다", () => {
  const v0 = vehicle([stop(37.604, 127.124, [stu("A"), stu("B")])], 2); // 만차(더 가까움)
  const v1 = vehicle([stop(37.500, 127.000, [stu("C")])], 9); // 여유(멀지만)
  const r = planIncrementalInsert([v0, v1], [target("P", 37.605, 127.125)], GEO);
  const in1 = r.vehicles[1].stops.some((s) => s.students.some((x) => x.requestId === "P"));
  assert.ok(in1, "여유 있는 v1에 배차");
  assert.equal(r.vehicles[0].passengers, 2, "만차 v0 불변");
});

test("위치변경: 기존 정차에서 제거 후 새 좌표로 재삽입", () => {
  const A = stop(37.600, 127.101, [stu("A")]);
  const B = stop(37.608, 127.148, [stu("MOVE")]); // MOVE가 원래 여기 있음
  const v = vehicle([A, B]);
  // MOVE의 새 좌표를 A 근처로 → B 정차는 비어 제거, A 근처에 재삽입
  const r = planIncrementalInsert([v], [target("MOVE", 37.6001, 127.1011)], GEO);
  const veh = r.vehicles[0];
  const bGone = !veh.stops.some((s) => s.label === B.label);
  assert.ok(bGone, "빈 정차(B) 제거");
  const hasMove = veh.stops.some((s) => s.students.some((x) => x.requestId === "MOVE"));
  assert.ok(hasMove, "새 좌표에 재삽입");
  assert.ok(r.reroute.includes(0), "기하 변경 → reroute");
});

test("무료탑승(isHub) 학생은 기존 hub 정차에 추가(새 정차 X, reroute 없음)", () => {
  const hub = stop(37.606, 127.130, [stu("H1")], { isHub: true });
  const v = vehicle([hub, stop(37.601, 127.101, [stu("A")])]);
  const r = planIncrementalInsert([v], [target("HUBNEW", null, null, { isHub: true })], GEO);
  const veh = r.vehicles[0];
  const hubStop = veh.stops.find((s) => s.isHub === true);
  assert.equal(hubStop.students.length, 2, "hub에 학생 추가");
  assert.equal(r.reroute.length, 0, "hub 추가는 기하 불변");
  assert.equal(r.unassigned.length, 0);
});

test("좌표 없는 일반 학생은 unassigned", () => {
  const v = vehicle([stop(37.601, 127.101, [stu("A")])]);
  const r = planIncrementalInsert([v], [target("NOGEO", null, null)], GEO);
  assert.equal(r.unassigned.length, 1);
  assert.equal(r.unassigned[0].name, "NOGEO");
});

test("입력을 변형하지 않는다(원본 stops 불변)", () => {
  const A = stop(37.601, 127.101, [stu("A")]);
  const v = vehicle([A]);
  const origLen = v.stops.length;
  const origStudents = v.stops[0].students.length;
  planIncrementalInsert([v], [target("NEW", 37.603, 127.103)], GEO);
  assert.equal(v.stops.length, origLen, "원본 정차 개수 불변");
  assert.equal(v.stops[0].students.length, origStudents, "원본 학생 배열 불변");
});

test("빈 노선 차량에도 삽입 가능(start-end 사이)", () => {
  const v = vehicle([], 9);
  const r = planIncrementalInsert([v], [target("ONLY", 37.605, 127.125)], GEO);
  assert.equal(r.vehicles[0].stops.length, 1);
  assert.equal(r.vehicles[0].passengers, 1);
});

test("haversineKm 기본 성질(같은 점=0, 대칭)", () => {
  assert.equal(haversineKm(START, START), 0);
  assert.ok(Math.abs(haversineKm(START, END) - haversineKm(END, START)) < 1e-9);
});
