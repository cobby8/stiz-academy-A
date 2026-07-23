import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const preflightSource = await readFile("scripts/release-preflight.mjs", "utf8");
const setupGuide = await readFile("docs/sms-provider-setup.md", "utf8");

test("production과 preview 배포 사전점검은 문자 개인정보 비밀키를 요구한다", () => {
  assert.match(preflightSource, /MESSAGE_PRIVACY_HMAC_SECRET/);
  assert.match(preflightSource, /\["production", "preview"\]\.includes\(scope\)/);
  assert.match(preflightSource, /Buffer\.byteLength\(value, "utf8"\) >= 32/);
  assert.doesNotMatch(preflightSource, /console\.(?:log|error)\([^)]*MESSAGE_PRIVACY_HMAC_SECRET[^)]*process\.env/);
});

test("문자 설정 문서는 비밀키를 서버에서 안전하고 일관되게 관리하도록 안내한다", () => {
  assert.match(setupGuide, /MESSAGE_PRIVACY_HMAC_SECRET/);
  assert.match(setupGuide, /최소 32바이트/);
  assert.match(setupGuide, /Production/);
  assert.match(setupGuide, /Preview/);
  assert.match(setupGuide, /암호학적으로 안전한 방식/);
  assert.match(setupGuide, /운영 중에는 값을 안정적으로 유지/);
  assert.match(setupGuide, /로그.*실제 값을.*출력하지 않습니다/);
  assert.match(setupGuide, /`NEXT_PUBLIC_` 접두사를 붙이지 않습니다/);
});
