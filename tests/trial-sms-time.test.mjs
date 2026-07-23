import assert from "node:assert/strict";
import test from "node:test";

import { formatTrialSmsDateTime } from "../src/lib/trial-sms-time.ts";

test("체험 확정 문자 시간은 서버 시간대와 무관하게 한국 시간으로 표시한다", () => {
  assert.equal(
    formatTrialSmsDateTime("2026-07-23T09:00:00.000Z"),
    "2026년 7월 23일 (목) 18:00",
  );
});

test("한국 자정을 넘는 일정은 한국 기준 날짜와 요일을 사용한다", () => {
  assert.equal(
    formatTrialSmsDateTime("2026-07-23T16:30:00.000Z"),
    "2026년 7월 24일 (금) 01:30",
  );
});

test("일정이 없거나 잘못된 값이면 빈 문자열을 반환한다", () => {
  assert.equal(formatTrialSmsDateTime(null), "");
  assert.equal(formatTrialSmsDateTime("not-a-date"), "");
});
