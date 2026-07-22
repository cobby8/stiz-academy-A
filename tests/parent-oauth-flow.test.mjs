import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const startRoute = readFileSync("src/app/auth/oauth/[provider]/route.ts", "utf8");
const callbackRoute = readFileSync("src/app/auth/callback/route.ts", "utf8");
const helper = readFileSync("src/lib/parent-oauth.ts", "utf8");
const continuePage = readFileSync("src/app/auth/continue/page.tsx", "utf8");

test("parent OAuth only permits the configured providers and internal redirects", () => {
  assert.match(helper, /\["google", "kakao", "naver"\]/);
  assert.match(helper, /value\.startsWith\("\/\/"\)/);
  assert.match(startRoute, /safeInternalRedirect/);
});

test("Naver OAuth stays closed until the custom provider is configured", () => {
  assert.match(helper, /SUPABASE_NAVER_PROVIDER_ENABLED/);
  assert.match(helper, /custom:naver/);
  assert.match(startRoute, /네이버 간편가입을 준비 중입니다/);
});

test("OAuth callback requires application membership and phone verification", () => {
  assert.match(callbackRoute, /exchangeCodeForSession/);
  assert.match(callbackRoute, /"phoneVerifiedAt"/);
  assert.match(callbackRoute, /appUser\?\.role === "PARENT" && \(appUser\.phoneVerifiedAt \|\| appUser\.username === null\)/);
  assert.match(callbackRoute, /"authUserId" = \$1 OR \("authUserId" IS NULL AND id = \$1\)/);
  assert.match(callbackRoute, /\/signup\/parent/);
  assert.doesNotMatch(callbackRoute, /user_metadata/);
});

test("authenticated identities cannot bypass parent phone onboarding", () => {
  assert.match(continuePage, /parseAppRole/);
  assert.match(continuePage, /role === "PARENT" && rows\[0\]\?\.username !== null && !rows\[0\]\?\.phoneVerifiedAt/);
  assert.match(continuePage, /\/signup\/parent/);
});
