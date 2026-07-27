import { test } from "node:test";
import assert from "node:assert/strict";
import { groupPendingChildren } from "../src/lib/seasonal/pendingSeasonalChildren.ts";

// 좌석 행 헬퍼
function seat(o = {}) {
  return {
    applicationId: o.applicationId ?? "app1",
    childName: o.childName ?? "김철수",
    childGrade: o.childGrade ?? "초3",
    convertedStudentId: o.convertedStudentId ?? null,
    conversionStatus: o.conversionStatus ?? "NOT_STARTED",
    offeringTitle: o.offeringTitle ?? "여름 A반",
    enrollmentDateId: o.enrollmentDateId ?? "e1",
    isFuture: o.isFuture ?? true,
    attendanceStatus: o.attendanceStatus ?? null,
  };
}

test("기본 그룹핑 — 자녀 1명, 예정 회차 집계", () => {
  const out = groupPendingChildren([seat(), seat({ enrollmentDateId: "e2" })], []);
  assert.equal(out.length, 1);
  assert.equal(out[0].childName, "김철수");
  assert.equal(out[0].upcomingCount, 2);
  assert.equal(out[0].pastCount, 0);
  assert.deepEqual(out[0].offeringTitles, ["여름 A반"]);
});

test("특강 이름 중복 제거 + 여러 특강", () => {
  const out = groupPendingChildren(
    [seat(), seat({ enrollmentDateId: "e2", offeringTitle: "여름 B반" }), seat({ enrollmentDateId: "e3" })],
    [],
  );
  assert.deepEqual(out[0].offeringTitles, ["여름 A반", "여름 B반"]);
});

test("전환 완료(conversionStatus=COMPLETED) 신청은 제외", () => {
  const out = groupPendingChildren([seat({ conversionStatus: "COMPLETED" })], []);
  assert.equal(out.length, 0);
});

test("convertedStudentId 가 대시보드 studentIds 에 있으면 제외", () => {
  const out = groupPendingChildren([seat({ convertedStudentId: "stu-1" })], ["stu-1"]);
  assert.equal(out.length, 0);
});

test("convertedStudentId 가 studentIds 에 없으면 유지", () => {
  const out = groupPendingChildren([seat({ convertedStudentId: "stu-9" })], ["stu-1"]);
  assert.equal(out.length, 1);
});

test("과거/미래 회차 분리 집계", () => {
  const out = groupPendingChildren(
    [seat({ isFuture: true }), seat({ enrollmentDateId: "e2", isFuture: false })],
    [],
  );
  assert.equal(out[0].upcomingCount, 1);
  assert.equal(out[0].pastCount, 1);
});

test("출결 상태 집계", () => {
  const out = groupPendingChildren(
    [
      seat({ enrollmentDateId: "e1", attendanceStatus: "PRESENT" }),
      seat({ enrollmentDateId: "e2", attendanceStatus: "LATE" }),
      seat({ enrollmentDateId: "e3", attendanceStatus: "ABSENT" }),
      seat({ enrollmentDateId: "e4", attendanceStatus: "EXCUSED" }),
    ],
    [],
  );
  assert.deepEqual(out[0].attendance, { present: 1, late: 1, absent: 1, excused: 1 });
});

test("이름+학년 조합이 다르면 별개 자녀", () => {
  const out = groupPendingChildren(
    [seat({ childName: "김철수", childGrade: "초3" }), seat({ childName: "김철수", childGrade: "초5" })],
    [],
  );
  assert.equal(out.length, 2);
});

test("이름이 비면 제외(안전)", () => {
  const out = groupPendingChildren([{ ...seat(), childName: "" }, { ...seat(), childName: null }], []);
  assert.equal(out.length, 0);
});

test("좌석 없는 신청(enrollmentDateId=null)도 특강 이름은 표시, 회차 0", () => {
  const noSeat = { ...seat(), enrollmentDateId: null, isFuture: null };
  const out = groupPendingChildren([noSeat], []);
  assert.equal(out.length, 1);
  assert.equal(out[0].upcomingCount, 0);
  assert.equal(out[0].pastCount, 0);
  assert.deepEqual(out[0].offeringTitles, ["여름 A반"]);
});
