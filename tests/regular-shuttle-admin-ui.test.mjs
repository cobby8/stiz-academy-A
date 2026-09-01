import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const client = readFileSync("src/app/admin/shuttle/regular/RegularShuttleClient.tsx", "utf8");
const routeSection = readFileSync("src/components/shuttle/RegularRouteSection.tsx", "utf8");
const noticeRoute = readFileSync("src/app/api/admin/shuttle/regular-notice/route.ts", "utf8");
const geocodePanel = readFileSync("src/components/shuttle/RegularStopGeocodePanel.tsx", "utf8");
const dispatchPage = readFileSync("src/app/admin/shuttle/regular-dispatch/page.tsx", "utf8");
const seasonalRouteSection = readFileSync("src/components/seasonal/RouteSection.tsx", "utf8");

test("정규 셔틀 월 선택은 한국시간과 가장 가까운 이전 월을 사용한다", () => {
  assert.match(client, /timeZone: "Asia\/Seoul"/);
  assert.match(client, /month < serviceMonth/);
  assert.match(client, /closestPreviousMonth/);
  assert.match(noticeRoute, /compareMonth >= serviceMonth/);
});

test("모바일에서도 정차 순서를 위아래 버튼으로 바꿀 수 있다", () => {
  assert.match(routeSection, /aria-label=\{`\$\{g\.label\} 위로 이동`\}/);
  assert.match(routeSection, /reorder\(i, i - 1\)/);
  assert.match(routeSection, /aria-label=\{`\$\{g\.label\} 아래로 이동`\}/);
  assert.match(routeSection, /reorder\(i, i \+ 1\)/);
});

test("정차 순서 저장은 현재 선택한 운영 월을 함께 보내 다른 월 수정을 막는다", () => {
  assert.match(client, /serviceMonth=\{serviceMonth\}/);
  assert.match(routeSection, /body: JSON\.stringify\(\{ serviceMonth, updates \}\)/);
});

test("문자 미리보기는 공용 접근성 모달과 승인·발송 2단계를 쓴다", () => {
  assert.match(client, /<AdminModal titleId="shuttle-message-preview-title"/);
  assert.match(client, /승인 전에는 발송되지 않으며, 승인 후 별도 발송할 수 있습니다/);
  assert.doesNotMatch(client, /확인 및 복사만 가능합니다/);
  assert.match(client, /noticeAction\("APPROVE"/);
  assert.match(client, /noticeAction\("SEND"/);
  assert.match(client, /아래 승인만으로 문자가 발송되지는 않습니다/);
});

test("문자 원장은 변경 시 승인을 무효화하고 승인된 최신 payload만 한 번 발송한다", () => {
  assert.match(noticeRoute, /RegularShuttleNoticeBatch/);
  assert.match(noticeRoute, /getRegularShuttleStops\(compareMonth\)/);
  assert.match(noticeRoute, /diffRegularShuttleMonths/);
  assert.match(noticeRoute, /status='CANCELLED'/);
  assert.match(noticeRoute, /PAYLOAD_CHANGED/);
  assert.match(noticeRoute, /status='HELD'/);
  assert.match(noticeRoute, /status='APPROVED'/);
  assert.match(noticeRoute, /WHERE "payloadHash"=\$1 AND status='APPROVED'/);
  assert.match(noticeRoute, /status='UNCERTAIN'/);
  assert.match(noticeRoute, /status='SENT'/);
  assert.match(noticeRoute, /eventId: payload\.payloadHash/);
});

test("정규 셔틀 좌표는 정류장별 후보와 지도 핀을 확인한 뒤 한 곳씩 저장한다", () => {
  assert.match(geocodePanel, /검색 후보를 선택하세요/);
  assert.match(geocodePanel, /draggable: true/);
  assert.match(geocodePanel, /이 위치 확인 후 저장/);
  assert.match(geocodePanel, /entries: \[\{ stopName: selectedName/);
  assert.match(dispatchPage, /totalStopCount/);
});

test("정규 배차의 좌표 누락 명단은 기본 접고 설정 화면으로 안내한다", () => {
  assert.match(seasonalRouteSection, /href="#regular-stop-coordinate-setup"/);
  assert.match(seasonalRouteSection, /누락 학생 확인/);
});
