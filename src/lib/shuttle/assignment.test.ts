import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node 내장 테스트 러너는 TypeScript 확장자 import를 실행할 수 있다.
import { chooseActiveShuttleAssignment } from "./assignment.ts";

const assignments = [
  { routePlanId: "draft", stopId: "stop-draft", routePlan: { status: "DRAFT" as const } },
  { routePlanId: "confirmed", stopId: "stop-confirmed", routePlan: { status: "CONFIRMED" as const } },
];

test("명시한 새 배정이 있으면 기존 확정본보다 우선한다", () => {
  assert.equal(chooseActiveShuttleAssignment(assignments, "draft")?.routePlanId, "draft");
});

test("우선 배정이 없으면 확정 노선을 선택한다", () => {
  assert.equal(chooseActiveShuttleAssignment(assignments)?.routePlanId, "confirmed");
});

test("남은 활성 배정이 없으면 미배정 상태로 돌아갈 수 있다", () => {
  assert.equal(chooseActiveShuttleAssignment([]), undefined);
});
