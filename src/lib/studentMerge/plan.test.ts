import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error -- Node's type-stripping runner needs the runtime extension.
import { chooseRepresentative, countActive, finalEnrollmentStatuses, isBillingRowMovable, planEnrollmentMerge, SOFT_SKIP_STATUS, statusPriority, type EnrollmentRow, type MergeCandidate } from "./plan.ts";

function candidate(
  id: string,
  billing: number,
  childRows: number,
  createdAt: string,
  enrollments: EnrollmentRow[] = [],
): MergeCandidate {
  return {
    id,
    liveBillingCountFromFreeze: billing,
    liveChildRowCount: childRows,
    createdAt,
    enrollments,
  };
}

test("8월 확정 청구가 붙은 쪽이 무조건 대표가 된다", () => {
  const a = candidate("A", 0, 9999, "2026-03-31T05:58:00Z");
  const b = candidate("B", 1, 3, "2026-07-12T09:19:00Z");
  const pick = chooseRepresentative(a, b);
  assert.equal(pick.winnerId, "B");
  assert.equal(pick.loserId, "A");
  assert.equal(pick.rule, "FROZEN_BILLING");
});

test("8월 청구가 양쪽에 다 있으면 자동 판단하지 않고 멈춘다", () => {
  const a = candidate("A", 1, 10, "2026-03-31T05:58:00Z");
  const b = candidate("B", 2, 10, "2026-07-12T09:19:00Z");
  assert.throws(() => chooseRepresentative(a, b), /자동 대표 선정 불가/);
});

test("8월 청구가 양쪽 다 없으면 살아있는 기록이 많은 쪽이 대표", () => {
  const a = candidate("A", 0, 28, "2026-03-31T05:58:00Z");
  const b = candidate("B", 0, 231, "2026-07-14T01:10:00Z");
  const pick = chooseRepresentative(a, b);
  assert.equal(pick.winnerId, "B");
  assert.equal(pick.rule, "CHILD_ROWS");
});

test("청구도 기록도 동률이면 먼저 만들어진 쪽이 대표", () => {
  const a = candidate("A", 0, 5, "2026-03-31T05:58:00Z");
  const b = candidate("B", 0, 5, "2026-07-12T09:20:00Z");
  const pick = chooseRepresentative(a, b);
  assert.equal(pick.winnerId, "A");
  assert.equal(pick.rule, "CREATED_FIRST");
});

test("수강 상태 우선순위는 ACTIVE > PAUSED > WITHDRAWN, 모르는 값은 최하위", () => {
  assert.ok(statusPriority("ACTIVE") > statusPriority("PAUSED"));
  assert.ok(statusPriority("PAUSED") > statusPriority("WITHDRAWN"));
  assert.equal(statusPriority("알수없음"), 0);
});

test("겹치지 않는 반은 그대로 이동한다", () => {
  const plan = planEnrollmentMerge(
    [{ id: "w1", classId: "Sun-8", status: "ACTIVE" }],
    [{ id: "l1", classId: "Mon-4", status: "ACTIVE" }],
  );
  assert.deepEqual(plan.move, [{ enrollmentId: "l1", classId: "Mon-4", status: "ACTIVE" }]);
  assert.equal(plan.promote.length, 0);
  assert.equal(plan.softSkip.length, 0);
});

test("같은 반이 겹치면 하드 삭제 없이 대표 쪽 상태를 올리고 흡수 쪽은 남긴다", () => {
  const plan = planEnrollmentMerge(
    [{ id: "w1", classId: "Wed-7", status: "PAUSED" }],
    [{ id: "l1", classId: "Wed-7", status: "ACTIVE" }],
  );
  assert.deepEqual(plan.promote, [
    { enrollmentId: "w1", classId: "Wed-7", fromStatus: "PAUSED", toStatus: "ACTIVE" },
  ]);
  assert.equal(plan.move.length, 0, "UNIQUE 충돌이므로 옮기면 안 된다");
  assert.deepEqual(plan.softSkip, [
    {
      enrollmentId: "l1",
      classId: "Wed-7",
      fromStatus: "ACTIVE",
      toStatus: SOFT_SKIP_STATUS,
      supersededBy: "w1",
    },
  ]);
});

test("대표 쪽이 더 살아있으면 상태를 낮추지 않는다", () => {
  const plan = planEnrollmentMerge(
    [{ id: "w1", classId: "Tue-5", status: "ACTIVE" }],
    [{ id: "l1", classId: "Tue-5", status: "PAUSED" }],
  );
  assert.equal(plan.promote.length, 0);
  assert.equal(plan.softSkip.length, 1);
});

test("박하준 실측 케이스: 병합 후 정확히 3개 반이 ACTIVE여야 한다", () => {
  // 대표 A: 일8 ACTIVE + 수7 PAUSED / 흡수 B: 월4 ACTIVE + 수7 ACTIVE
  const winner: EnrollmentRow[] = [
    { id: "a-sun8", classId: "Sun-8", status: "ACTIVE" },
    { id: "a-wed7", classId: "Wed-7", status: "PAUSED" },
  ];
  const loser: EnrollmentRow[] = [
    { id: "b-mon4", classId: "Mon-4", status: "ACTIVE" },
    { id: "b-wed7", classId: "Wed-7", status: "ACTIVE" },
  ];
  const plan = planEnrollmentMerge(winner, loser);
  const final = finalEnrollmentStatuses(winner, plan);

  assert.equal(countActive(final), 3);
  assert.equal(final.get("Sun-8"), "ACTIVE");
  assert.equal(final.get("Mon-4"), "ACTIVE");
  assert.equal(final.get("Wed-7"), "ACTIVE");
});

test("최현 실측 케이스: PAUSED가 WITHDRAWN을 이겨 대표 행이 승격된다", () => {
  const winner: EnrollmentRow[] = [{ id: "b-mon7", classId: "Mon-7", status: "WITHDRAWN" }];
  const loser: EnrollmentRow[] = [
    { id: "a-fri7", classId: "Fri-7", status: "PAUSED" },
    { id: "a-mon7", classId: "Mon-7", status: "PAUSED" },
  ];
  const plan = planEnrollmentMerge(winner, loser);
  assert.deepEqual(plan.move, [{ enrollmentId: "a-fri7", classId: "Fri-7", status: "PAUSED" }]);
  assert.equal(plan.promote[0]?.toStatus, "PAUSED");
  assert.equal(countActive(finalEnrollmentStatuses(winner, plan)), 0);
});

test("청구 이동 가드: 2026-08 이후는 절대 옮기지 않는다", () => {
  assert.equal(isBillingRowMovable(2026, 7), true);
  assert.equal(isBillingRowMovable(2026, 6), true);
  assert.equal(isBillingRowMovable(2025, 12), true);
  assert.equal(isBillingRowMovable(2026, 8), false);
  assert.equal(isBillingRowMovable(2026, 9), false);
  assert.equal(isBillingRowMovable(2027, 1), false);
});
