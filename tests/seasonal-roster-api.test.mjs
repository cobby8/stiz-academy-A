import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/admin/seasonal/route.ts", "utf8");

test("기존 GET 응답을 유지하면서 view=roster만 별도 분기한다", () => {
  assert.match(route, /searchParams\.get\("view"\) === "roster"/);
  assert.match(route, /return NextResponse\.json\(\{\s*seasons,\s*applications,/s);
});

test("확정 명단은 승인된 신청 항목을 기준으로 페이지를 나눈다", () => {
  assert.match(route, /WHERE item\.status = 'APPROVED'/);
  assert.match(route, /ORDER BY COALESCE\(\(SELECT MIN\(CASE selected\.day_key/);
  assert.match(route, /pageSize.*25.*1.*100/);
});

test("시즌 반 요일 결제 셔틀 검색 필터를 서버에서 처리한다", () => {
  for (const name of ["seasonId", "offeringId", "weekday", "paymentStatus", "shuttleStatus", "q"]) {
    assert.match(route, new RegExp(`params\\.get\\("${name}"\\)`));
  }
  assert.match(route, /AT TIME ZONE 'Asia\/Seoul'/);
});

test("반별 명단 요일은 실제 운영 반과 학생 신청 요일을 사용한다", () => {
  const roster = route.slice(route.indexOf("async function seasonalRoster"), route.indexOf("async function ensureApplicationCapacity"));
  assert.match(roster, /filter_offering\."linkedClassId" IS NOT NULL/);
  assert.match(roster, /ANY\(app\."selectedWeekdays"\)/);
  assert.match(roster, /unnest\(app\."selectedWeekdays"\) AS selected\(day_key\)/);
});

test("검색과 결제·셔틀 필터는 운영 의미로 정규화한다", () => {
  assert.match(route, /regexp_replace\(\$6, '\[\^0-9\]', '', 'g'\) <> ''/);
  assert.match(route, /payment\.status IN \('PAID','COMPLETED'\) OR invoice\.status IN \('PAID','COMPLETED'\)/);
  assert.match(route, /WHEN \$5 = 'NOT_USED' THEN shuttle\.id IS NULL/);
  assert.match(route, /WHEN \$5 = 'ASSIGNED' THEN shuttle\."assignedRouteId" IS NOT NULL AND shuttle\."assignedStopId" IS NOT NULL/);
});

test("좌석 결제 셔틀 통계를 항목 단위로 계산한다", () => {
  assert.match(route, /AS "confirmedSeats"/);
  assert.match(route, /AS "heldSeats"/);
  assert.match(route, /AS unpaid/);
  assert.match(route, /AS "shuttleRequested"/);
  assert.match(route, /AS "shuttleUnassigned"/);
});

test("기본 명단 DTO는 전화번호를 마스킹하고 비밀 URL을 포함하지 않는다", () => {
  assert.match(route, /parentPhone: maskedPhone\(row\.parentPhone\)/);
  const roster = route.slice(route.indexOf("async function seasonalRoster"), route.indexOf("async function ensureApplicationCapacity"));
  assert.doesNotMatch(roster, /activationUrl|checkoutUrl|tokenHash/);
});

test("CSV helper가 이후 같은 명단 DTO를 소비할 수 있게 조회와 응답 조립이 분리돼 있다", () => {
  assert.match(route, /type SeasonalRosterRow/);
  assert.match(route, /const rosterRows = rows\.map/);
  assert.match(route, /roster: \{ rows: rosterRows, stats, pagination \}/);
  assert.match(route, /filters: \{ seasonId, offeringId, weekday, paymentStatus, shuttleStatus, q: query \}/);
});
