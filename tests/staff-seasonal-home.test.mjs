import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeSource = readFileSync("src/app/staff/StaffHomeClient.tsx", "utf8");

test("강사 홈은 정규 수업과 방학특강을 고유 일정키로 구분한다", () => {
  assert.match(homeSource, /lesson\.kind === "SEASONAL"/);
  assert.match(homeSource, /key=\{lesson\.scheduleKey\}/);
  assert.match(homeSource, /lesson\.scheduleKey !== focusClass\?\.scheduleKey/);
});

test("방학특강 수업 시작 요청은 회차 식별자를 함께 보낸다", () => {
  assert.match(homeSource, /startTarget\.sessionDateId/);
  assert.match(homeSource, /\{ sessionDateId: startTarget\.sessionDateId \}/);
  assert.match(homeSource, /startClassSession\(\{/);
});

test("방학특강 학생 정보 패널은 회차 식별자를 함께 보낸다", () => {
  assert.match(homeSource, /sessionDateId=\{peopleTarget\.sessionDateId\}/);
  assert.match(homeSource, /peopleTarget\.sessionId \|\| peopleTarget\.sessionDateId/);
});
