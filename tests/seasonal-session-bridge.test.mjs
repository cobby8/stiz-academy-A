import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const bridge = readFileSync("src/lib/seasonal/session-bridge.ts", "utf8");
const route = readFileSync("src/app/api/admin/seasonal/route.ts", "utf8");
const admin = readFileSync("src/app/admin/seasonal/SeasonalAdminClient.tsx", "utf8");

test("특강 회차와 출석 Session을 일대일로 연결한다", () => {
  assert.match(schema, /specialProgramSessionDateId\s+String\?\s+@unique/);
  assert.match(schema, /onDelete: Restrict/);
  assert.match(bridge, /sessionKey: `seasonal:\$\{sessionDate\.id\}`/);
  assert.match(bridge, /status: "PLANNED"/);
});

test("서울 날짜 기준으로 출석 Session 날짜를 만든다", () => {
  assert.match(bridge, /timeZone: "Asia\/Seoul"/);
  assert.match(bridge, /T00:00:00\.000Z/);
});

test("진행 또는 출석 기록이 있는 회차의 삭제와 시간 변경을 잠근다", () => {
  assert.match(bridge, /session\.status !== "PLANNED"/);
  assert.match(bridge, /session\._count\.attendances > 0/);
  assert.match(bridge, /SESSION_DATE_LOCKED/g);
});

test("관리자 수정은 기존 회차 ID를 보존해 API로 전달한다", () => {
  assert.match(admin, /id: row\.id, startsAt:/);
  assert.match(route, /id: cleanText\(row\.id, 100\) \|\| null/);
  assert.doesNotMatch(route, /specialProgramSessionDate\.deleteMany/);
  assert.doesNotMatch(route, /specialProgramSessionDate\.createMany/);
});

test("모집 공개에는 출석 연결 반과 담당 강사가 필요하다", () => {
  assert.match(route, /ATTENDANCE_LINK_REQUIRED/g);
  assert.match(route, /!nextLinkedClassId \|\| !nextInstructorId/);
});

test("진행 전 빈 출석 세션만 특강과 함께 안전하게 삭제한다", () => {
  assert.match(route, /SEASONAL_SESSION_PROTECTED/g);
  assert.match(route, /status: \{ not: "PLANNED" \}/);
  assert.match(route, /attendances: \{ some: \{\} \}/);
  assert.match(route, /session\.deleteMany/);
});
