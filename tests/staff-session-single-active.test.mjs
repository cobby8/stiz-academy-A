import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actionSource = readFileSync("src/app/actions/staff-sessions.ts", "utf8");
const homeSource = readFileSync("src/app/staff/StaffHomeClient.tsx", "utf8");
const sessionPageSource = readFileSync("src/app/staff/sessions/[sessionId]/page.tsx", "utf8");

test("교사별 잠금과 서버 조회로 동시에 한 수업만 시작한다", () => {
  assert.match(actionSource, /pg_advisory_xact_lock\(hashtext\(\$1\)\)/);
  assert.match(actionSource, /status = 'IN_PROGRESS'[\s\S]*"startedByUserId" = \$1/);
  assert.match(actionSource, /code: "ACTIVE_SESSION"/);
});

test("홈은 진행 중인 수업이 있으면 다른 수업 시작을 잠근다", () => {
  assert.match(homeSource, /startLocked=\{Boolean\(runningClass/);
  assert.match(homeSource, /현재 수업 종료 후 시작/);
  assert.match(homeSource, /disabled=\{startLocked\}/);
  assert.match(homeSource, /result\.code === "ACTIVE_SESSION"[\s\S]*activeSessionId/);
});

test("진행 중이 아닌 수업 주소는 교사 홈으로 돌려보낸다", () => {
  assert.match(sessionPageSource, /session\.status !== "IN_PROGRESS"/);
  assert.match(sessionPageSource, /redirect\("\/staff"\)/);
});
