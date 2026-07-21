import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeSource = readFileSync("src/app/staff/StaffHomeClient.tsx", "utf8");

test("강사 홈은 특강을 구분하고 회차별 고유 키를 사용한다", () => {
  assert.match(homeSource, /lesson\.kind === "SEASONAL"/);
  assert.match(homeSource, />특강<\/span>/);
  assert.match(homeSource, /key=\{lesson\.scheduleKey\}/);
  assert.match(homeSource, /lesson\.scheduleKey !== focusClass\?\.scheduleKey/);
});

test("특강 수업 시작 요청에는 회차 식별자를 전달한다", () => {
  assert.match(homeSource, /startTarget\.sessionDateId/);
  assert.match(homeSource, /\{ sessionDateId: startTarget\.sessionDateId \}/);
  assert.match(homeSource, /startClassSession\(\{/);
});
