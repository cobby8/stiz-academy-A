import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const middlewareSource = await readFile("src/lib/supabase/middleware.ts", "utf8");
const configSource = await readFile("next.config.ts", "utf8");
const loginSource = await readFile("src/app/login/page.tsx", "utf8");

test("교사용 로그인은 설치 앱의 /staff 범위 안에서 공용 로그인 화면을 재사용한다", () => {
  assert.match(configSource, /source:\s*["']\/staff\/login["']/);
  assert.match(configSource, /destination:\s*["']\/login\?mode=staff["']/);
  assert.match(middlewareSource, /pathname === ["']\/staff\/login["']/);
  assert.match(middlewareSource, /pathname\.startsWith\(["']\/staff["']\) && !isStaffLogin/);
  assert.match(loginSource, /pathname === ["']\/staff\/login["']/);
});

test("미인증 staff 요청은 /staff/login으로 보내고 로그인 후 원래 경로를 유지한다", () => {
  assert.match(
    middlewareSource,
    /pathname\.startsWith\(["']\/staff["']\) \? ["']\/staff\/login["'] : ["']\/login["']/,
  );
  assert.match(middlewareSource, /url\.searchParams\.set\(["']redirect["'], pathname\)/);
  assert.match(loginSource, /\(isStaffMode \? ["']\/staff["'] : null\)/);
});
