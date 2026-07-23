import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const querySource = readFileSync(new URL("./staff-session-queries.ts", import.meta.url), "utf8");
const accessSource = readFileSync(new URL("./staff-class-access.ts", import.meta.url), "utf8");
const actionSource = readFileSync(new URL("../app/actions/staff-sessions.ts", import.meta.url), "utf8");
const staffPeopleSource = readFileSync(new URL("./staff-class-people.ts", import.meta.url), "utf8");
const staffHomeSource = readFileSync(new URL("../app/staff/StaffHomeClient.tsx", import.meta.url), "utf8");

test("방학특강 회차는 실제 세션 담당 교사 또는 기본 담당자만 접근한다", () => {
  assert.match(accessSource, /matched_s\."coachId" = \$3/);
  assert.match(accessSource, /matched_o\."instructorId" = \$3/);
  assert.match(querySource, /access_s\."coachId" = \$3/);
  assert.match(querySource, /access_o\."instructorId" = \$3/);
  assert.match(querySource, /access\.coachId/);
  assert.match(querySource, /AT TIME ZONE 'Asia\/Seoul'/);
});

test("방학특강 출석 명단은 승인되고 전환 완료된 신청 학생으로 제한한다", () => {
  assert.match(querySource, /i\.status = 'APPROVED'/);
  assert.match(querySource, /i\."conversionStatus" IN \('COMPLETED', 'INVOICE_RETRY_REQUIRED'\)/);
  assert.match(actionSource, /isSessionRosterStudent/);
  assert.match(actionSource, /getSessionParentRecipients/);
});

test("방학특강 출석 명단은 신청 요일과 실제 회차 요일을 맞춘다", () => {
  assert.match(querySource, /selectedWeekdays/);
  assert.match(actionSource, /selectedWeekdays/);
  assert.match(querySource, /EXTRACT\(ISODOW FROM sd\."startsAt" AT TIME ZONE 'Asia\/Seoul'\)::int/);
  assert.match(actionSource, /EXTRACT\(ISODOW FROM sd\."startsAt" AT TIME ZONE 'Asia\/Seoul'\)::int/);
});

test("정규 수업과 같은 날짜의 방학특강 세션은 서로 분리한다", () => {
  assert.match(querySource, /s\."specialProgramSessionDateId" IS NULL/);
  assert.match(querySource, /CASE WHEN sd\.id IS NOT NULL[\s\S]*app\."convertedStudentId"/);
});

test("방학특강 시작은 회차 기반 세션키와 서버 날짜 검증을 사용한다", () => {
  assert.match(actionSource, /sessionDateId\?: string/);
  assert.match(actionSource, /`seasonal:\$\{sessionDateId\}`/);
  assert.match(actionSource, /AT TIME ZONE 'Asia\/Seoul'/);
  assert.match(actionSource, /specialProgramSessionDateId/);
});

test("선생님 수업 관리 명단은 방학특강 회차 ID를 넘겨 해당 요일 학생만 조회한다", () => {
  assert.match(staffPeopleSource, /requireStaffSeasonalSessionAccess/);
  assert.match(staffPeopleSource, /resolveSessionDateId/);
  assert.match(staffPeopleSource, /anchor_sd\.id = \$1/);
  assert.match(staffPeopleSource, /selectedWeekdays/);
  assert.match(staffHomeSource, /sessionDateId=\{peopleTarget\.sessionDateId\}/);
});
