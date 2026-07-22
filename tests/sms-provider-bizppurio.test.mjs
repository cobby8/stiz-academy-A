import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const smsSource = await readFile("src/lib/sms.ts", "utf8");
const inviteSource = await readFile("src/app/actions/invite.ts", "utf8");
const releasePreflightSource = await readFile("scripts/release-preflight.mjs", "utf8");
const smsSetupDoc = await readFile("docs/sms-provider-setup.md", "utf8");

test("sms sender supports Bizppurio token and message API", () => {
  assert.match(smsSource, /SMS_PROVIDER/);
  assert.match(smsSource, /BIZPPURIO_ACCOUNT/);
  assert.match(smsSource, /BIZPPURIO_PASSWORD/);
  assert.match(smsSource, /BIZPPURIO_API_KEY/);
  assert.match(smsSource, /BIZPPURIO_SENDER/);
  assert.match(smsSource, /BIZPPURIO_FROM/);
  assert.match(smsSource, /\/v1\/token/);
  assert.match(smsSource, /Authorization:\s*`Basic \${basic}`/);
  assert.match(smsSource, /\/v3\/message/);
  assert.match(smsSource, /Authorization:\s*`Bearer \${token}`/);
  assert.match(smsSource, /String\(json\?\.code\) === "1000"/);
  assert.match(smsSource, /bizppurioMessageType/);
  assert.match(smsSource, /content = type === "sms"/);
});

test("staff invite sms configuration check is provider-neutral", () => {
  assert.match(smsSource, /export function isSmsProviderConfigured/);
  assert.match(inviteSource, /isSmsProviderConfigured/);
  assert.doesNotMatch(inviteSource, /SOLAPI_API_KEY \|\|/);
  assert.doesNotMatch(inviteSource, /process\.env\.SOLAPI_API_SECRET/);
});

test("release preflight accepts either Bizppurio or Solapi sms environment", () => {
  assert.match(releasePreflightSource, /function currentSmsProvider/);
  assert.match(releasePreflightSource, /function requireSmsEnvironment/);
  assert.match(releasePreflightSource, /BIZPPURIO_ACCOUNT/);
  assert.match(releasePreflightSource, /BIZPPURIO_PASSWORD/);
  assert.match(releasePreflightSource, /BIZPPURIO_API_KEY/);
  assert.match(releasePreflightSource, /SOLAPI_API_KEY/);
  assert.match(releasePreflightSource, /requireSmsEnvironment\(missing\)/);
});

test("sms provider setup guide documents required Bizppurio rollout values", () => {
  assert.match(smsSetupDoc, /SMS_PROVIDER=BIZPPURIO/);
  assert.match(smsSetupDoc, /BIZPPURIO_HOST=api\.bizppurio\.com/);
  assert.match(smsSetupDoc, /서버 IP 등록/);
  assert.match(smsSetupDoc, /발신번호 사전 등록/);
});
