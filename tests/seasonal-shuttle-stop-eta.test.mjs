// 정차 수동 확정 시각(etaManual) 오버레이 순수 로직 단위 테스트.
// 대상: src/lib/seasonal/shuttleStopEta.ts (confirmedEtaMin / stopKey / etaMinToLabel / reapplyManualEta / reapplyManualEtaVehicles)
import test from "node:test";
import assert from "node:assert/strict";
import {
  confirmedEtaMin,
  etaMinToLabel,
  stopKey,
  reapplyManualEta,
  reapplyManualEtaVehicles,
} from "../src/lib/seasonal/shuttleStopEta.ts";

const stop = (o) => ({ lat: 37.5, lng: 127.0, students: [], ...o });

test("confirmedEtaMin: 수동값 우선, 없으면 자동값, 둘 다 없으면 null", () => {
  assert.equal(confirmedEtaMin(stop({ etaMinutes: 500, etaManual: 480 })), 480);
  assert.equal(confirmedEtaMin(stop({ etaMinutes: 500 })), 500);
  assert.equal(confirmedEtaMin(stop({ etaManual: 0 })), 0); // 0도 유효한 확정값
  assert.equal(confirmedEtaMin(stop({})), null);
  assert.equal(confirmedEtaMin(stop({ etaManual: null, etaMinutes: 300 })), 300); // null=미확정
});

test("etaMinToLabel: 방향별 라벨 + 24시 wrap", () => {
  assert.equal(etaMinToLabel(533, "PICKUP"), "08:53 승차");
  assert.equal(etaMinToLabel(980, "DROPOFF"), "16:20 하차");
  assert.equal(etaMinToLabel(1440 + 5, "PICKUP"), "00:05 승차"); // 자정 넘어가면 wrap
});

test("stopKey: requestId 집합은 순서 무관 동일 키, 승객 없으면 좌표 폴백", () => {
  const a = stop({ students: [{ requestId: "b" }, { requestId: "a" }] });
  const b = stop({ students: [{ requestId: "a" }, { requestId: "b" }] });
  assert.equal(stopKey(a), stopKey(b)); // 정렬되므로 순서 무관
  assert.equal(stopKey(a), "r:a,b");
  assert.equal(stopKey(stop({ lat: 37.51234, lng: 127.05678 })), "c:37.51234,127.05678");
});

test("reapplyManualEta: 순서가 바뀌어도 같은 승객 묶음에 확정값이 따라간다", () => {
  const prior = [
    stop({ students: [{ requestId: "s1" }], etaMinutes: 500, etaManual: 470 }),
    stop({ students: [{ requestId: "s2" }], etaMinutes: 520 }),
  ];
  // 재계산 결과: 순서가 뒤바뀌고 자동값도 새로 계산됨(확정값 없음)
  const recomputed = [
    stop({ students: [{ requestId: "s2" }], etaMinutes: 610 }),
    stop({ students: [{ requestId: "s1" }], etaMinutes: 590 }),
  ];
  const out = reapplyManualEta(recomputed, prior, "PICKUP");
  const s1 = out.find((x) => x.students[0].requestId === "s1");
  const s2 = out.find((x) => x.students[0].requestId === "s2");
  assert.equal(s1.etaManual, 470); // 확정값 유지(자동값 590으로 안 덮임)
  assert.equal(s1.etaLabel, "07:50 승차"); // 470분 = 07:50
  assert.equal(s1.etaMinutes, 590); // 자동값은 최신으로 갱신(리셋 기준)
  assert.equal(s2.etaManual, undefined); // 확정 안 된 정차는 자동
  assert.equal(s2.etaMinutes, 610);
});

test("reapplyManualEta: prior에서 리셋된(etaManual 없는) 정차는 자동으로 복귀", () => {
  const prior = [stop({ students: [{ requestId: "s1" }], etaMinutes: 500 })]; // 확정 없음
  const recomputed = [stop({ students: [{ requestId: "s1" }], etaMinutes: 540, etaManual: 999 })];
  const out = reapplyManualEta(recomputed, prior, "PICKUP");
  assert.equal(out[0].etaManual, undefined); // prior에 확정 없으므로 떨어뜨림
});

test("reapplyManualEta: 매칭 안 되는 신규 정차는 그대로 자동", () => {
  const prior = [stop({ students: [{ requestId: "old" }], etaMinutes: 500, etaManual: 400 })];
  const recomputed = [stop({ students: [{ requestId: "new" }], etaMinutes: 480 })];
  const out = reapplyManualEta(recomputed, prior, "DROPOFF");
  assert.equal(out[0].etaManual, undefined);
  assert.equal(out[0].etaMinutes, 480);
});

test("reapplyManualEta: 입력 불변(원본 배열/객체를 변형하지 않음)", () => {
  const prior = [stop({ students: [{ requestId: "s1" }], etaManual: 470 })];
  const recomputed = [stop({ students: [{ requestId: "s1" }], etaMinutes: 590 })];
  const snapshot = JSON.stringify(recomputed);
  reapplyManualEta(recomputed, prior, "PICKUP");
  assert.equal(JSON.stringify(recomputed), snapshot); // 원본 그대로
});

test("reapplyManualEtaVehicles: 차량이 갈려도 같은 승객 묶음이면 확정 유지", () => {
  const prior = [
    { stops: [stop({ students: [{ requestId: "s1" }], etaManual: 460 })] },
    { stops: [stop({ students: [{ requestId: "s2" }], etaMinutes: 520 })] },
  ];
  // s1이 다른 차량으로 이동한 재계산 결과
  const recomputed = [
    { stops: [stop({ students: [{ requestId: "s2" }], etaMinutes: 500 }), stop({ students: [{ requestId: "s1" }], etaMinutes: 610 })] },
  ];
  const out = reapplyManualEtaVehicles(recomputed, prior, "PICKUP");
  const s1 = out[0].stops.find((x) => x.students[0].requestId === "s1");
  assert.equal(s1.etaManual, 460); // 다른 차량으로 옮겨도 확정 유지
  assert.equal(s1.etaLabel, "07:40 승차");
});

test("stopKey 폴백 좌표 매칭: 무료탑승 거점(승객 없음)도 확정 유지", () => {
  const prior = [stop({ students: [], lat: 37.5, lng: 127.0, isHub: true, etaManual: 450 })];
  const recomputed = [stop({ students: [], lat: 37.5, lng: 127.0, isHub: true, etaMinutes: 470 })];
  const out = reapplyManualEta(recomputed, prior, "PICKUP");
  assert.equal(out[0].etaManual, 450); // 좌표 폴백으로 매칭
});
