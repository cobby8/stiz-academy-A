import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const bridge = readFileSync("src/lib/seasonal/session-bridge.ts", "utf8");
const route = readFileSync("src/app/api/admin/seasonal/route.ts", "utf8");
const admin = readFileSync("src/app/admin/seasonal/SeasonalAdminClient.tsx", "utf8");
const staffQueries = readFileSync("src/lib/staff-session-queries.ts", "utf8");
const staffAccess = readFileSync("src/lib/staff-class-access.ts", "utf8");

test("특강 출석 Session은 운영반과 시간 기준으로 하나만 만든다", () => {
  assert.match(schema, /specialProgramSessionDateId\s+String\?\s+@unique/);
  assert.match(schema, /onDelete: Restrict/);
  assert.match(bridge, /function findOperationalSession/);
  assert.match(bridge, /sd\."startsAt" = \$2/);
  assert.match(bridge, /sd\."endsAt" = \$3/);
  assert.match(bridge, /o\."linkedClassId" = \$1/);
  assert.match(bridge, /o\."seasonId" = current_o\."seasonId"/);
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

test("미연결 특강도 정원과 회차가 있으면 모집 공개할 수 있다", () => {
  assert.match(route, /status === "OPEN" && capacity === null/);
  assert.match(route, /nextStatus === "OPEN" && nextCapacity === null/);
  assert.match(route, /status === "OPEN" && sessionDates\.length === 0/);
  assert.doesNotMatch(route, /ATTENDANCE_LINK_REQUIRED/);
  assert.doesNotMatch(route, /!nextLinkedClassId \|\| !nextInstructorId/);
});

test("미연결 특강은 출석 Session을 만들거나 강사 화면에 노출하지 않는다", () => {
  assert.match(bridge, /if \(input\.linkedClassId\)/);
  assert.match(bridge, /else if \(previous\?\.session\)/);
  assert.match(bridge, /await tx\.session\.delete/);
  assert.match(staffQueries, /JOIN "Class" c ON c\.id = o\."linkedClassId"/);
  assert.match(staffAccess, /anchor_o\."linkedClassId" IS NOT NULL/);
});

test("강사 홈의 특강 대표 회차는 이미 생성된 출석 Session을 우선한다", () => {
  assert.match(staffQueries, /LEFT JOIN "Session" existing_s ON existing_s\."specialProgramSessionDateId" = sd\.id/);
  assert.match(staffQueries, /ARRAY_AGG\(sd\.id ORDER BY CASE WHEN existing_s\.id IS NULL THEN 1 ELSE 0 END, sd\.id\)\)\[1\] AS "sessionDateId"/);
});

test("선생님 특강 권한은 같은 운영반과 시간대의 배정 정보를 함께 본다", () => {
  assert.match(staffAccess, /matched_sd\."startsAt" = anchor_sd\."startsAt"/);
  assert.match(staffAccess, /matched_o\."linkedClassId" = anchor_o\."linkedClassId"/);
  assert.match(staffAccess, /matched_o\."seasonId" = anchor_o\."seasonId"/);
  assert.match(staffAccess, /matched_o\."instructorId" = \$3/);
});

test("진행 전 빈 출석 세션만 특강과 함께 안전하게 삭제한다", () => {
  assert.match(route, /SEASONAL_SESSION_PROTECTED/g);
  assert.match(route, /status: \{ not: "PLANNED" \}/);
  assert.match(route, /attendances: \{ some: \{\} \}/);
  assert.match(route, /session\.deleteMany/);
});
