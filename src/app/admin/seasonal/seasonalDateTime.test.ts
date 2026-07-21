import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node의 내장 TypeScript 테스트 실행기는 실제 .ts 확장자가 필요합니다.
import { seoulDateTimeToIso } from "./seasonalDateTime.ts";

test("datetime-local 10시는 서울 시간 10시로 보존된다", () => {
  const iso = seoulDateTimeToIso("2026-07-25T10:00");
  assert.equal(iso, "2026-07-25T01:00:00.000Z");
  assert.equal(new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)), "10:00");
});

test("불완전한 수업 시각은 전송하지 않는다", () => {
  assert.throws(() => seoulDateTimeToIso("2026-07-25"), /날짜와 시간을 확인/);
});
