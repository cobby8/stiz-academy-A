import test from "node:test";
import assert from "node:assert/strict";
import { reconcileSavedVehicles } from "../src/lib/seasonal/dispatchReconcile.ts";

// reconcile-on-read 순수 로직을 **실제로 돌려 보고** 검사한다.
//
// 저장된 배차 payload는 DB에서 바꾸지 않고, "읽을 때" 그날 유효하지 않은 학생만 걸러야 한다.
// 순서·시각·경로 보존이 핵심 계약이라, 소스 문자열 검사가 아니라 실행 결과로 확인한다.

// 저장본 한 대 예시(순서·시각·경로가 이미 확정된 상태).
function sampleVehicle() {
  return {
    index: 1,
    vehicleName: "1호차",
    plate: "12가3456",
    capacity: 3,
    tripLabel: null,
    passengers: 3,
    over: false,
    provider: "TMAP",
    tmapMinutes: 20,
    tmapKm: 8.3,
    depotTime: "08:30",
    departTime: "08:35",
    arriveTime: "09:20",
    path: [{ lat: 37.6, lng: 127.1 }, { lat: 37.61, lng: 127.15 }],
    stops: [
      {
        lat: 37.60, lng: 127.10, label: "정차A", approx: false, etaLabel: "08:40 승차",
        students: [
          { name: "가나", requestId: "req-1", rosterId: "r-1", pickupLabel: "정차A" },
          { name: "다라", requestId: "req-2", rosterId: "r-2", pickupLabel: "정차A" },
        ],
      },
      {
        lat: 37.61, lng: 127.15, label: "정차B", approx: true, etaLabel: "08:50 승차",
        students: [
          { name: "마바", requestId: "req-3", rosterId: "r-3", pickupLabel: "정차B" },
        ],
      },
      {
        // 무료탑승 거점(승객 0이어도 항상 유지되어야 함).
        lat: 37.62, lng: 127.20, label: "무료 탑승 거점", approx: false, isHub: true, etaLabel: "09:00 승차",
        students: [],
      },
    ],
  };
}

test("(a) 유효 Set에 없는 학생은 제거된다", () => {
  const vehicles = [sampleVehicle()];
  // req-2는 결석/취소되어 유효 명단에서 빠졌다고 가정.
  const out = reconcileSavedVehicles(vehicles, new Set(["req-1", "req-3"]));
  const stopA = out[0].stops.find((s) => s.label === "정차A");
  const names = stopA.students.map((s) => s.requestId);
  assert.deepEqual(names, ["req-1"]);
});

test("(b) 학생이 0명이 된 정차는 제거하되 isHub 정차는 유지한다", () => {
  const vehicles = [sampleVehicle()];
  // req-3만 유효 → 정차A는 전원 탈락(제거), 정차B 유지, 거점(isHub)은 승객 0이어도 유지.
  const out = reconcileSavedVehicles(vehicles, new Set(["req-3"]));
  const labels = out[0].stops.map((s) => s.label);
  assert.ok(!labels.includes("정차A"), "빈 정차A는 제거되어야 한다");
  assert.ok(labels.includes("정차B"), "승객 있는 정차B는 유지");
  assert.ok(labels.includes("무료 탑승 거점"), "isHub 거점은 승객 0이어도 유지");
});

test("(c) passengers/over가 재계산된다", () => {
  const v = sampleVehicle();
  v.capacity = 1; // 정원 1명으로 낮춰 초과 판정 확인
  const out = reconcileSavedVehicles([v], new Set(["req-1", "req-3"]));
  // 남는 학생: req-1(정차A) + req-3(정차B) = 2명, 거점은 0명.
  assert.equal(out[0].passengers, 2);
  assert.equal(out[0].over, true); // 2 > capacity(1)

  // 정원이 넉넉하면 over=false
  const out2 = reconcileSavedVehicles([sampleVehicle()], new Set(["req-1"]));
  assert.equal(out2[0].passengers, 1);
  assert.equal(out2[0].over, false); // 1 > capacity(3) → false
});

test("(d) 순서·etaLabel·departTime 등 시각·경로는 보존된다", () => {
  const vehicles = [sampleVehicle()];
  const out = reconcileSavedVehicles(vehicles, new Set(["req-1", "req-3"]));
  const run = out[0];
  // 시각·경로·제공자 정보 그대로
  assert.equal(run.departTime, "08:35");
  assert.equal(run.arriveTime, "09:20");
  assert.equal(run.depotTime, "08:30");
  assert.equal(run.provider, "TMAP");
  assert.equal(run.tmapMinutes, 20);
  assert.equal(run.tmapKm, 8.3);
  assert.deepEqual(run.path, [{ lat: 37.6, lng: 127.1 }, { lat: 37.61, lng: 127.15 }]);
  // 남은 정차 순서: 정차A → 정차B → 거점 (원래 순서 유지)
  assert.deepEqual(run.stops.map((s) => s.label), ["정차A", "정차B", "무료 탑승 거점"]);
  // 각 정차의 etaLabel·좌표 보존
  assert.equal(run.stops[0].etaLabel, "08:40 승차");
  assert.equal(run.stops[1].etaLabel, "08:50 승차");
  assert.equal(run.stops[0].lat, 37.60);
  assert.equal(run.stops[0].approx, false);
});

test("DB를 바꾸지 않는다: 입력 배열/원본 학생 배열은 변형되지 않는다(불변)", () => {
  const vehicles = [sampleVehicle()];
  const before = JSON.parse(JSON.stringify(vehicles));
  reconcileSavedVehicles(vehicles, new Set(["req-1"]));
  assert.deepEqual(vehicles, before, "원본 입력이 변형되면 안 된다");
});

test("전원이 다시 유효해지면 저장본이 그대로 복원된다(자가치유)", () => {
  const vehicles = [sampleVehicle()];
  const out = reconcileSavedVehicles(vehicles, new Set(["req-1", "req-2", "req-3"]));
  assert.equal(out[0].stops.length, 3);
  assert.equal(out[0].passengers, 3);
  assert.equal(out[0].over, false);
});

// ────────────────────────────────────────────────────────────────
// 라벨 갱신(reconcile-on-read): 명단 라벨을 고치면 저장본의 얼어붙은 라벨도 읽을 때 따라온다.
// ────────────────────────────────────────────────────────────────

test("(라벨) 학생 pickupLabel이 현재 명단 라벨로 갱신된다", () => {
  const vehicles = [sampleVehicle()];
  // req-1의 명단 라벨을 새 텍스트로 변경했다고 가정.
  const labels = new Map([["req-1", "정차A-수정됨"], ["req-2", "정차A-수정됨"]]);
  const out = reconcileSavedVehicles(vehicles, new Set(["req-1", "req-2", "req-3"]), labels);
  const stopA = out[0].stops.find((s) => s.students.some((st) => st.requestId === "req-1"));
  const s1 = stopA.students.find((st) => st.requestId === "req-1");
  assert.equal(s1.pickupLabel, "정차A-수정됨");
});

test("(라벨) 비허브 정차의 표시 label이 첫 학생의 새 라벨로 갱신된다", () => {
  const vehicles = [sampleVehicle()];
  const labels = new Map([["req-1", "새라벨A"], ["req-2", "새라벨A"], ["req-3", "새라벨B"]]);
  const out = reconcileSavedVehicles(vehicles, new Set(["req-1", "req-2", "req-3"]), labels);
  const stopA = out[0].stops.find((s) => s.students.some((st) => st.requestId === "req-1"));
  const stopB = out[0].stops.find((s) => s.students.some((st) => st.requestId === "req-3"));
  assert.equal(stopA.label, "새라벨A");
  assert.equal(stopB.label, "새라벨B");
});

test("(라벨) isHub 거점 라벨은 절대 갱신되지 않는다", () => {
  const v = sampleVehicle();
  // 거점 정차에도 학생을 하나 앉혀 두고, 라벨맵에 그 학생의 새 라벨을 넣어도 거점명은 그대로여야 한다.
  const hub = v.stops.find((s) => s.isHub === true);
  hub.students = [{ name: "거점학생", requestId: "req-hub", rosterId: null, pickupLabel: "무료 탑승 거점" }];
  const labels = new Map([["req-hub", "바뀌면안됨"]]);
  const out = reconcileSavedVehicles([v], new Set(["req-hub"]), labels);
  const outHub = out[0].stops.find((s) => s.isHub === true);
  assert.equal(outHub.label, "무료 탑승 거점", "허브 정차 label은 고정명 유지");
  // 단, 학생 개인 pickupLabel은 갱신 대상(정차명과는 별개).
  assert.equal(outHub.students[0].pickupLabel, "바뀌면안됨");
});

test("(라벨) 좌표·시각·순서는 라벨 갱신 중에도 불변", () => {
  const vehicles = [sampleVehicle()];
  const labels = new Map([["req-1", "X"], ["req-2", "X"], ["req-3", "Y"]]);
  const out = reconcileSavedVehicles(vehicles, new Set(["req-1", "req-2", "req-3"]), labels);
  const run = out[0];
  assert.equal(run.departTime, "08:35");
  assert.equal(run.arriveTime, "09:20");
  assert.deepEqual(run.path, [{ lat: 37.6, lng: 127.1 }, { lat: 37.61, lng: 127.15 }]);
  const stopA = run.stops.find((s) => s.students.some((st) => st.requestId === "req-1"));
  assert.equal(stopA.lat, 37.60);
  assert.equal(stopA.lng, 127.10);
  assert.equal(stopA.etaLabel, "08:40 승차");
  // 정차 순서 보존
  assert.deepEqual(run.stops.map((s) => s.students.length), [2, 1, 0]);
});

test("(라벨) 라벨맵이 없으면 기존 라벨을 그대로 유지(하위호환)", () => {
  const vehicles = [sampleVehicle()];
  const out = reconcileSavedVehicles(vehicles, new Set(["req-1", "req-2", "req-3"]));
  const stopA = out[0].stops.find((s) => s.label === "정차A");
  assert.ok(stopA, "라벨맵 없으면 정차A 라벨 그대로");
  assert.equal(stopA.students[0].pickupLabel, "정차A");
});
