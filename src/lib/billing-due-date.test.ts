import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error -- Node의 타입 제거 실행기는 런타임 확장자를 요구한다.
import { DUE_DATE_DAYS_BEFORE_START, GENERAL_REGISTRATION_DAYS_BEFORE, PRIORITY_REGISTRATION_DAYS_BEFORE, dueDateForCourseStart, monthlyBillingDueDate, monthlyCourseStartDate, monthlyRegistrationWindow, registrationWindowForCourseStart } from "./billing-due-date.ts";

test("월 단위 수강 개시일은 그 달 1일이다", () => {
    assert.equal(monthlyCourseStartDate(2026, 8), "2026-08-01");
    assert.equal(monthlyCourseStartDate(2026, 12), "2026-12-01");
    assert.equal(monthlyCourseStartDate(2026, 1), "2026-01-01");
});

test("납부기한은 수강 개시일 전날 = 전월 말일", () => {
    assert.equal(monthlyBillingDueDate(2026, 8), "2026-07-31"); // 31일 달
    assert.equal(monthlyBillingDueDate(2026, 9), "2026-08-31");
    assert.equal(monthlyBillingDueDate(2026, 5), "2026-04-30"); // 30일 달
});

test("연도 경계: 1월분 기한은 전년 12월 31일", () => {
    assert.equal(monthlyBillingDueDate(2027, 1), "2026-12-31");
});

test("윤년/평년 2월 경계", () => {
    assert.equal(monthlyBillingDueDate(2026, 3), "2026-02-28"); // 평년
    assert.equal(monthlyBillingDueDate(2028, 3), "2028-02-29"); // 윤년
});

test("기존 하드코딩(매월 10일)과 다른 결과를 낸다 — 회귀 방어", () => {
    // 예전 규칙: 2026-08-10 (수강 시작 후) / 새 규칙: 2026-07-31 (수강 시작 전)
    assert.notEqual(monthlyBillingDueDate(2026, 8), "2026-08-10");
    assert.ok(monthlyBillingDueDate(2026, 8) < monthlyCourseStartDate(2026, 8));
});

test("기한은 언제나 수강 개시일보다 앞선다 — 약관 '수강일 전까지' 불변식", () => {
    for (let month = 1; month <= 12; month += 1) {
        const start = monthlyCourseStartDate(2026, month);
        const due = monthlyBillingDueDate(2026, month);
        assert.ok(due < start, `${month}월: ${due} < ${start}`);
    }
});

test("납부 가능 구간: 우선등록 2주 전, 일반등록 1주 전", () => {
    const window = monthlyRegistrationWindow(2026, 8);
    assert.deepEqual(window, {
        courseStartDate: "2026-08-01",
        priorityStartDate: "2026-07-18",
        generalStartDate: "2026-07-25",
        dueDate: "2026-07-31",
    });
});

test("구간 순서 불변식: 우선 < 일반 < 기한 < 개시", () => {
    const w = monthlyRegistrationWindow(2027, 3);
    assert.ok(w.priorityStartDate < w.generalStartDate);
    assert.ok(w.generalStartDate < w.dueDate);
    assert.ok(w.dueDate < w.courseStartDate);
});

test("상수는 약관 수치와 일치한다", () => {
    assert.equal(PRIORITY_REGISTRATION_DAYS_BEFORE, 14);
    assert.equal(GENERAL_REGISTRATION_DAYS_BEFORE, 7);
    assert.equal(DUE_DATE_DAYS_BEFORE_START, 1);
});

test("임의 개시일(특강 등)에도 같은 규칙이 적용된다", () => {
    assert.equal(dueDateForCourseStart("2026-07-27"), "2026-07-26");
    assert.equal(dueDateForCourseStart("2026-03-01"), "2026-02-28");
    assert.deepEqual(registrationWindowForCourseStart("2026-07-27"), {
        courseStartDate: "2026-07-27",
        priorityStartDate: "2026-07-13",
        generalStartDate: "2026-07-20",
        dueDate: "2026-07-26",
    });
});

test("타임존과 무관하게 같은 값을 낸다 — Date 객체 저장 시 하루 밀리던 버그 방어", () => {
    // 문자열 계산이므로 실행 환경(KST/UTC)에 좌우되지 않는다.
    const due = monthlyBillingDueDate(2026, 8);
    assert.equal(due, "2026-07-31");
    assert.equal(due.length, 10);
    assert.match(due, /^\d{4}-\d{2}-\d{2}$/);
});

test("잘못된 입력은 조용히 통과하지 않는다", () => {
    assert.throws(() => monthlyCourseStartDate(2026, 0), /월이 올바르지 않습니다/);
    assert.throws(() => monthlyCourseStartDate(2026, 13), /월이 올바르지 않습니다/);
    assert.throws(() => monthlyCourseStartDate(1999, 5), /연도가 올바르지 않습니다/);
    assert.throws(() => dueDateForCourseStart("2026/08/01"), /날짜 형식이 올바르지 않습니다/);
    assert.throws(() => dueDateForCourseStart("2026-02-31"), /존재하지 않는 날짜입니다/);
});
