import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("src/lib/seasonal/service.ts", "utf8");
const types = readFileSync("src/components/seasonal/types.ts", "utf8");
const apply = readFileSync("src/components/seasonal/SeasonalApplyClient.tsx", "utf8");

test("공개 특강 응답과 화면 타입에 셔틀 운행 여부를 전달한다", () => {
  assert.match(service, /shuttleAvailable: offering\.shuttleAvailable/);
  assert.match(types, /shuttleAvailable: boolean/);
  assert.match(types, /shuttleAvailable: row\.shuttleAvailable === true/);
});

test("셔틀 운행 특강에만 신청 UI와 제출 데이터가 활성화된다", () => {
  assert.match(apply, /const shuttleAvailable = selected && priceItem\.shuttleAvailable/);
  assert.match(apply, /\{shuttleAvailable && \(/);
  assert.match(apply, /shuttle: offering\.shuttleAvailable && hasShuttle/);
  assert.match(apply, /offering\?\.shuttleAvailable/);
});
