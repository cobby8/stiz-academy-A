import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const diff = readFileSync(new URL("../src/lib/regular/regularShuttleDiff.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const importSource = readFileSync(new URL("../src/lib/shuttle/regularImport.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/app/admin/shuttle/regular/RegularShuttleClient.tsx", import.meta.url), "utf8");

test("정규 차량표와 저장 노선은 월별로 보존된다", () => {
  assert.match(schema, /model RegularShuttleStop[\s\S]*serviceMonth\s+String/);
  assert.match(schema, /model RegularDispatchRoute[\s\S]*@@unique\(\[serviceMonth, dayOfWeek, direction\]\)/);
  assert.match(importSource, /DELETE FROM "RegularShuttleStop" WHERE "serviceMonth"=\$1/);
  assert.doesNotMatch(importSource, /DELETE FROM "RegularShuttleStop"`\)/);
});

test("차량 변동은 학생별 추가·제외·변경으로 구분한다", () => {
  assert.match(diff, /"ADDED" \| "REMOVED" \| "CHANGED"/);
  assert.match(diff, /beforeText === afterText/);
  assert.match(diff, /parentPhone/);
});

test("정규 차량 화면은 비교 결과를 보여주되 문자를 자동 발송하지 않는다", () => {
  assert.match(client, /차량 변동 \{comparison\.length\}명/);
  assert.match(client, /문자는 자동 발송되지 않습니다/);
  assert.doesNotMatch(client, /sendManualSms|sendSms|shuttle-notice.*POST/);
});
