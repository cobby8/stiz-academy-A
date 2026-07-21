import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const querySource = readFileSync(new URL("./staff-session-queries.ts", import.meta.url), "utf8");
const accessSource = readFileSync(new URL("./staff-class-access.ts", import.meta.url), "utf8");
const actionSource = readFileSync(new URL("../app/actions/staff-sessions.ts", import.meta.url), "utf8");

test("특강 회차는 담당 강사와 관리자만 조회한다", () => {
  assert.match(accessSource, /o\."instructorId" = \$3/);
  assert.match(querySource, /o\."instructorId" = \$3/);
  assert.match(querySource, /AT TIME ZONE 'Asia\/Seoul'/);
});

test("특강 출석 명단은 승인되고 전환 완료된 학생으로 격리한다", () => {
  assert.match(querySource, /i\.status = 'APPROVED'/);
  assert.match(querySource, /i\."conversionStatus" IN \('COMPLETED', 'INVOICE_RETRY_REQUIRED'\)/);
  assert.match(actionSource, /isSessionRosterStudent/);
  assert.match(actionSource, /getSessionParentRecipients/);
});

test("특강 출석 명단은 신청 요일과 실제 회차 요일을 맞춘다", () => {
  assert.match(querySource, /selectedWeekdays/);
  assert.match(actionSource, /selectedWeekdays/);
  assert.match(querySource, /EXTRACT\(ISODOW FROM sd\."startsAt" AT TIME ZONE 'Asia\/Seoul'\)::int/);
  assert.match(actionSource, /EXTRACT\(ISODOW FROM sd\."startsAt" AT TIME ZONE 'Asia\/Seoul'\)::int/);
});

test("정규 수업과 같은 날짜의 특강 세션을 서로 격리한다", () => {
  assert.match(querySource, /s\."specialProgramSessionDateId" IS NULL/);
  assert.match(querySource, /CASE WHEN sd\.id IS NOT NULL[\s\S]*app\."convertedStudentId"/);
});

test("특강 시작은 회차 기반 멱등키와 서버 날짜 검증을 사용한다", () => {
  assert.match(actionSource, /sessionDateId\?: string/);
  assert.match(actionSource, /`seasonal:\$\{sessionDateId\}`/);
  assert.match(actionSource, /AT TIME ZONE 'Asia\/Seoul'/);
  assert.match(actionSource, /specialProgramSessionDateId/);
});
