import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./ShuttleRouteAdminClient.tsx", import.meta.url), "utf8");

test("셔틀 관리 화면은 시즌과 등하원 방향을 기준으로 조회한다", () => {
  assert.match(source, /new URLSearchParams\(\{ direction: requestedDirection \}\)/);
  assert.match(source, /query\.set\("seasonId", requestedSeasonId\)/);
  assert.match(source, /query\.set\("serviceDate", requestedServiceDate\)/);
  assert.match(source, /\}, \[direction, serviceDate\]\)/);
  assert.match(source, /"PICKUP", "DROPOFF"/);
  assert.match(source, /등원/);
  assert.match(source, /하원/);
});

test("운행일별 노선과 미배정 후보를 분리한다", () => {
  assert.match(source, /정기 노선 \(날짜 없음\)/);
  assert.match(source, /route\.serviceDate\?\.slice\(0, 10\) === serviceDate/);
  assert.match(source, /setServiceDate\(event\.target\.value\)/);
  assert.match(source, /setServiceDate\(""\); setDirection\(value\)/);
});

test("서버의 충돌 응답을 관리자에게 그대로 안내하고 정류장 순서는 1부터 전송한다", () => {
  assert.match(source, /result\.error \|\| "셔틀 정보를 저장하지 못했습니다\."/);
  assert.match(source, /stopOrder: stopOrder \+ 1/);
  assert.match(source, /stopOrder: itemIndex \+ 1/);
});

test("노선 편성 핵심 동작을 관리자 API 계약으로 요청한다", () => {
  for (const action of ["reorder", "assign", "unassign", "confirm", "complete", "archive", "revise"]) {
    assert.match(source, new RegExp(`action: "${action}"`));
  }
  assert.match(source, /resource: "vehicle"/);
  assert.match(source, /resource: "route"/);
});

test("관리자는 기사 체크 현황을 즉시 또는 자동으로 새로고침한다", () => {
  assert.match(source, /autoRefresh/);
  assert.match(source, /window\.setInterval/);
  assert.match(source, /새 상태 불러오기/);
  assert.match(source, /30초 자동 새로고침/);
});

test("운행 완료는 체크 대기 학생이 남아 있으면 막는다", () => {
  assert.match(source, /운행 완료/);
  assert.match(source, /action: "complete"/);
  assert.match(source, /rideSummary\.pending > 0 \|\| pending/);
  assert.match(source, /체크 대기 학생을 모두/);
});

test("모바일에서도 순서 변경과 외부 지도 확인이 가능하다", () => {
  assert.match(source, /순서를 위로 이동/);
  assert.match(source, /순서를 아래로 이동/);
  assert.match(source, /https:\/\/map\.kakao\.com\/link\/map/);
  assert.match(source, /min-w-0/);
});

test("확정 전 정원과 필수 정보를 확인하고 접근 가능한 모달을 사용한다", () => {
  assert.match(source, /passengerCount > capacity/);
  assert.match(source, /<AdminModal titleId=/);
  assert.match(source, /노선을 확정하시겠습니까/);
  assert.match(source, /data-admin-modal-initial-focus/);
});
