import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const apiSource = readFileSync("src/app/api/admin/attendance/route.ts", "utf8");
const clientSource = readFileSync("src/app/admin/attendance/AttendanceClient.tsx", "utf8");
const queriesSource = readFileSync("src/lib/queries.ts", "utf8");
const payloadSource = readFileSync("src/lib/adminReadPayloads.ts", "utf8");
const adminActionSource = readFileSync("src/app/actions/admin.ts", "utf8");

test("관리자 출석은 날짜별 정규 수업과 방학특강 회차를 함께 불러온다", () => {
  assert.match(payloadSource, /getAttendanceClassOptions\(dateKey\)/);
  assert.match(apiSource, /getCachedAdminAttendancePayload\(date\)/);
  assert.match(queriesSource, /kind: "SEASONAL" as const/);
  assert.match(queriesSource, /kind: "REGULAR" as const/);
});

test("방학특강 출석은 sessionDateId로 정규 수업 출석과 분리된다", () => {
  assert.match(apiSource, /searchParams\.get\("sessionDateId"\)/);
  assert.match(apiSource, /getAttendanceByDateAndClass\(date, classId, sessionDateId\)/);
  assert.match(clientSource, /lessonKeyOf/);
  assert.match(clientSource, /sessionDateId: selectedLesson\.sessionDateId/);
  assert.match(queriesSource, /"specialProgramSessionDateId" IS NULL/);
});

test("관리자 출석 저장은 방학특강 요일별 명단만 저장한다", () => {
  assert.match(adminActionSource, /getAdminSeasonalRosterStudentIds/);
  assert.match(adminActionSource, /allowedRecords = records\.filter/);
  assert.match(adminActionSource, /`seasonal:\$\{sessionDateId\}`/);
  assert.match(adminActionSource, /"specialProgramSessionDateId"/);
});
