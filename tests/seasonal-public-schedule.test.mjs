import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const service = await readFile(new URL("../src/lib/seasonal/service.ts", import.meta.url), "utf8");
const types = await readFile(new URL("../src/components/seasonal/types.ts", import.meta.url), "utf8");
const detail = await readFile(new URL("../src/components/seasonal/SeasonalDetailClient.tsx", import.meta.url), "utf8");
const apply = await readFile(new URL("../src/components/seasonal/SeasonalApplyClient.tsx", import.meta.url), "utf8");

test("공개 특강 응답은 전체 회차를 시작 시각순으로 직렬화한다", () => {
  assert.match(service, /orderedSessionDates[\s\S]*\.sort\(/);
  assert.match(service, /sessionDates: orderedSessionDates\.map/);
  assert.match(service, /startsAt: sessionStartsAt\.toISOString\(\)/);
  assert.match(service, /timeZone: "Asia\/Seoul"/);
});

test("기존 첫 회차 필드와 전체 회차 타입을 함께 유지한다", () => {
  assert.match(types, /dayLabel: string/);
  assert.match(types, /startTime: string/);
  assert.match(types, /sessionDates: SeasonalSessionDate\[\]/);
  assert.match(types, /const first = dates\[0\]/);
});

test("상세와 신청 화면은 전체 회차 날짜 요일 시간을 표시한다", () => {
  assert.match(detail, /전체 수업 일정/);
  assert.match(detail, /session\.dateLabel.*session\.dayLabel.*session\.startTime.*session\.endTime/);
  assert.match(apply, /전체 수업 일정/);
  assert.match(apply, /session\.dateLabel.*session\.dayLabel.*session\.startTime.*session\.endTime/);
  assert.match(apply, /총 \{item\.sessionDates\.length\}회/);
});
