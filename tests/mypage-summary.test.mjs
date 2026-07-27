import { test } from "node:test";
import assert from "node:assert/strict";

import {
    getKstNow,
    getKstDateStr,
    computeNextClass,
    nextClassWhenLabel,
    filterTodayShuttle,
} from "../src/lib/mypage/summary.ts";

// 2026-07-27은 월요일(KST). UTC 03:00 = KST 12:00.
const MON_NOON_UTC = new Date("2026-07-27T03:00:00Z");

test("getKstNow: UTC를 KST 요일/분으로 변환", () => {
    const n = getKstNow(MON_NOON_UTC);
    assert.equal(n.dayIndex, 1); // 월
    assert.equal(n.minutes, 12 * 60);
});

test("getKstNow: 자정 경계(UTC 15:00 = 다음날 KST 00:00)", () => {
    // 2026-07-27T15:00Z = 2026-07-28(화) 00:00 KST
    const n = getKstNow(new Date("2026-07-27T15:00:00Z"));
    assert.equal(n.dayIndex, 2); // 화
    assert.equal(n.minutes, 0);
});

test("getKstDateStr: KST 날짜 문자열", () => {
    assert.equal(getKstDateStr(MON_NOON_UTC), "2026-07-27");
    // UTC 15:00은 KST로 다음날
    assert.equal(getKstDateStr(new Date("2026-07-27T15:00:00Z")), "2026-07-28");
});

const nowKst = { dayIndex: 1, minutes: 12 * 60 }; // 월 12:00

test("computeNextClass: 오늘 늦은 수업이 가장 가까움", () => {
    const next = computeNextClass(
        [
            { className: "화요반", dayOfWeek: "Tue", startTime: "16:00", endTime: "17:00" },
            { className: "월요반", dayOfWeek: "Mon", startTime: "16:00", endTime: "17:00" },
        ],
        nowKst,
    );
    assert.equal(next?.className, "월요반"); // 오늘 16:00이 내일보다 가까움
    assert.equal(nextClassWhenLabel(next, nowKst), "오늘");
});

test("computeNextClass: 오늘 이미 지난 수업은 다음 주로 밀림", () => {
    const next = computeNextClass(
        [
            { className: "월오전", dayOfWeek: "Mon", startTime: "09:00", endTime: "10:00" },
            { className: "수요반", dayOfWeek: "Wed", startTime: "16:00", endTime: "17:00" },
        ],
        nowKst,
    );
    // 월 09:00은 이미 지남 → 수요일이 더 가까움
    assert.equal(next?.className, "수요반");
    assert.equal(nextClassWhenLabel(next, nowKst), "수요일");
});

test("computeNextClass: 내일 라벨", () => {
    const next = computeNextClass(
        [{ className: "화요반", dayOfWeek: "Tue", startTime: "10:00", endTime: "11:00" }],
        nowKst,
    );
    assert.equal(nextClassWhenLabel(next, nowKst), "내일");
});

test("computeNextClass: 수강 없음 → null", () => {
    assert.equal(computeNextClass([], nowKst), null);
});

test("computeNextClass: 잘못된 요일/시간은 무시", () => {
    const next = computeNextClass(
        [
            { className: "이상", dayOfWeek: "XXX", startTime: "99:99", endTime: "" },
            { className: "정상", dayOfWeek: "Fri", startTime: "16:00", endTime: "17:00" },
        ],
        nowKst,
    );
    assert.equal(next?.className, "정상");
});

test("filterTodayShuttle: 오늘 운행만 통과(ISO/날짜 혼용)", () => {
    const items = [
        { id: "a", serviceDate: "2026-07-27T00:00:00.000Z", direction: "PICKUP", status: "CONFIRMED" },
        { id: "b", serviceDate: "2026-07-28", direction: "DROPOFF", status: "CONFIRMED" },
        { id: "c", serviceDate: null, direction: null, status: "REQUESTED" },
    ];
    const today = filterTodayShuttle(items, "2026-07-27");
    assert.equal(today.length, 1);
    assert.equal(today[0].id, "a");
});
