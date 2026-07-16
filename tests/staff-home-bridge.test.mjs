import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutSource = await readFile("src/app/staff/layout.tsx", "utf8");
const menuSource = await readFile("src/app/staff/StaffProfileMenu.tsx", "utf8");
const homeLinkSource = await readFile("src/app/staff/StaffHomeLink.tsx", "utf8");
const navigationSource = await readFile("src/app/staff/staffNavigation.ts", "utf8");
const sessionSource = await readFile("src/app/staff/sessions/[sessionId]/SessionInProgressClient.tsx", "utf8");
const manifest = JSON.parse(await readFile("public/manifest-staff.json", "utf8"));

test("교사용 상단 프로필에서 홈페이지 정보와 앱 설치 안내로 이동할 수 있다", () => {
  assert.match(layoutSource, /<StaffProfileMenu staffName=\{staff\.appUserName\}/);
  for (const href of ["/", "/notices", "/programs", "/schedule", "/gallery", "/staff/install"]) {
    assert.ok(menuSource.includes(`href: "${href}"`) || menuSource.includes(`href="${href}"`), `${href} 바로가기가 있어야 합니다.`);
  }
  assert.match(menuSource, /action=\{logoutStaff\}/);
});

test("수업 중 공개 홈페이지 이동은 자동 저장 안내 확인을 거친다", () => {
  assert.match(menuSource, /pathname\.startsWith\("\/staff\/sessions\/"\)/);
  assert.match(menuSource, /event\.preventDefault\(\)/);
  assert.match(menuSource, /prepareStaffNavigation/);
  assert.match(navigationSource, /staff:prepare-navigation/);
  assert.match(menuSource, /저장이 완료되지 않으면 현재 화면에 머무릅니다/);
  assert.match(menuSource, /role="alertdialog"/);
  assert.match(sessionSource, /staff:prepare-navigation/);
  assert.match(sessionSource, /await persistMemo\(memoRef\.current\)/);
  assert.match(menuSource, /수업 종료 후 로그아웃/);
});

test("교사용 PWA 범위는 staff 내부로 유지한다", () => {
  assert.equal(manifest.scope, "/staff");
});

test("수업 중 교사용 로고도 메모 저장 확인 뒤 홈으로 이동한다", () => {
  assert.match(layoutSource, /<StaffHomeLink \/>/);
  assert.match(homeLinkSource, /pathname\.startsWith\("\/staff\/sessions\/"\)/);
  assert.match(homeLinkSource, /await prepareStaffNavigation\(\)/);
  assert.match(homeLinkSource, /저장 후 홈 이동/);
  assert.match(homeLinkSource, /role="alert"/);
});

test("시스템 뒤로가기도 수업 기록 저장 성공 뒤에만 허용한다", () => {
  assert.match(sessionSource, /history\.pushState\(/);
  assert.match(sessionSource, /addEventListener\("popstate"/);
  assert.match(sessionSource, /window\.confirm\("수업이 진행 중입니다/);
  assert.match(sessionSource, /voiceBusyRef\.current/);
  assert.match(sessionSource, /await persistMemo\(memoRef\.current\)/);
  assert.match(sessionSource, /history\.go\(-2\)/);
  assert.match(sessionSource, /else window\.location\.assign\("\/staff"\)/);
  assert.match(sessionSource, /removeEventListener\("popstate"/);
});
