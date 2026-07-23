import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminActions = await readFile(
  new URL("../src/app/actions/admin.ts", import.meta.url),
  "utf8",
);

const updateTrialLead = adminActions.slice(
  adminActions.indexOf("export async function updateTrialLead"),
  adminActions.indexOf("export async function deleteTrialLead"),
);

test("체험 일정 확정 전 서버가 유효한 날짜와 수업 반을 검증한다", () => {
  const validationPosition = updateTrialLead.indexOf('if (data.status === "SCHEDULED")');
  const updatePosition = updateTrialLead.indexOf('UPDATE "TrialLead" SET');

  assert.ok(validationPosition >= 0, "SCHEDULED 서버 검증이 필요합니다.");
  assert.ok(updatePosition > validationPosition, "검증은 DB 저장보다 먼저 실행되어야 합니다.");
  assert.match(updateTrialLead, /Number\.isNaN\(parsedScheduledDate\.getTime\(\)\)/);
  assert.match(updateTrialLead, /SELECT id, "dayOfWeek" FROM "Class" WHERE id = \$1 LIMIT 1/);
  assert.match(updateTrialLead, /scheduledClasses\.length === 0/);
  assert.match(updateTrialLead, /getSeoulWeekdayKey\(parsedScheduledDate\)/);
  assert.match(updateTrialLead, /classDay !== scheduledDay/);
});

test("기존 확정값을 사용하는 상태 변경도 검증하며 관리자 수동 시간은 허용한다", () => {
  assert.match(
    updateTrialLead,
    /data\.scheduledDate !== undefined[\s\S]*previousLead\?\.scheduledDate/,
  );
  assert.match(
    updateTrialLead,
    /data\.scheduledClassId !== undefined[\s\S]*previousLead\?\.scheduledClassId/,
  );
  assert.doesNotMatch(updateTrialLead, /scheduledDate[\s\S]{0,300}startTime/);
});
