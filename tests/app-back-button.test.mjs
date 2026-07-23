import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const backButtonSource = await readFile("src/components/AppBackButton.tsx", "utf8");
const standaloneBackButtonSource = await readFile("src/components/StandaloneBackButton.tsx", "utf8");
const rootLayoutSource = await readFile("src/app/layout.tsx", "utf8");
const publicHeaderSource = await readFile("src/components/PublicHeader.tsx", "utf8");
const adminShellSource = await readFile("src/app/admin/AdminShellClient.tsx", "utf8");
const staffLayoutSource = await readFile("src/app/staff/layout.tsx", "utf8");
const mypageLayoutSource = await readFile("src/app/mypage/layout.tsx", "utf8");

test("공통 뒤로가기 버튼은 앱 내부 이력 우선, 없으면 fallback으로 이동한다", () => {
  assert.match(backButtonSource, /router\.back\(\)/);
  assert.match(backButtonSource, /router\.push\(fallbackHref === pathname \? "\/" : fallbackHref\)/);
  assert.match(backButtonSource, /document\.referrer/);
  assert.match(backButtonSource, /window\.history\.state\?\.idx/);
});

test("공개, 관리자, 스태프, 마이페이지 헤더에 뒤로가기 버튼이 배치된다", () => {
  assert.match(publicHeaderSource, /<AppBackButton fallbackHref="\/" size="sm" \/>/);
  assert.match(adminShellSource, /<AppBackButton fallbackHref="\/admin" \/>/);
  assert.match(staffLayoutSource, /<AppBackButton fallbackHref="\/staff" \/>/);
  assert.match(mypageLayoutSource, /<AppBackButton fallbackHref="\/" size="sm" \/>/);
  assert.match(mypageLayoutSource, /<AppBackButton fallbackHref="\/" \/>/);
});

test("헤더가 없는 단독 화면은 전역 보조 뒤로가기 버튼으로 보완한다", () => {
  assert.match(rootLayoutSource, /<StandaloneBackButton \/>/);
  for (const prefix of ["/login", "/invite", "/payments", "/account/activate", "/auth/continue", "/signup/parent", "/teacher-app"]) {
    assert.ok(standaloneBackButtonSource.includes(prefix), `${prefix} should render standalone back button`);
  }
});
