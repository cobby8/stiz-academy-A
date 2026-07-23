import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const adminReadPayloads = readFileSync(new URL("../src/lib/adminReadPayloads.ts", import.meta.url), "utf8");
const scheduleRoute = readFileSync(new URL("../src/app/api/admin/schedule/route.ts", import.meta.url), "utf8");

test("관리자 시간표 첫 조회는 DB 시간표를 먼저 확인한다", () => {
  const payloadStart = adminReadPayloads.indexOf("export const getCachedAdminSchedulePayload");
  const payloadEnd = adminReadPayloads.indexOf("export function getCachedAdminTrialPayload");
  const payloadSource = adminReadPayloads.slice(payloadStart, payloadEnd);

  assert.match(payloadSource, /const \[dbScheduleData, coaches, programs\]/);
  assert.doesNotMatch(payloadSource, /const \[settings, dbScheduleData, coaches, programs\]/);
});

test("구글시트 설정과 캐시는 DB 시간표가 없을 때만 fallback으로 읽는다", () => {
  assert.match(adminReadPayloads, /if \(!scheduleData\) \{[\s\S]*getAcademySettings\(\)[\s\S]*getSheetSlotCache\(\)/);
  assert.match(scheduleRoute, /legacy-settings/);
  assert.match(scheduleRoute, /if \(!scheduleData\) \{[\s\S]*getAcademySettings\(\)[\s\S]*legacy-fallback-data/);
});
