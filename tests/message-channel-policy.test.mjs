import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const policy = fs.readFileSync("src/lib/message-channel-policy.ts", "utf8");
const dispatch = fs.readFileSync("src/lib/message-dispatch.ts", "utf8");
const sms = fs.readFileSync("src/lib/sms.ts", "utf8");

test("authentication messages are locked to SMS without channel fallback", () => {
  assert.match(policy, /input\.audience === "AUTH"/);
  assert.match(policy, /primaryChannel: "SMS"[\s\S]*fallbackAllowed: false/);
});

test("alimtalk requires Solapi profile and template registration", () => {
  assert.match(policy, /SOLAPI_KAKAO_PF_ID/);
  assert.match(policy, /templateId\?\.trim\(\)/);
  assert.match(dispatch, /kakaoOptions/);
});

test("unavailable alimtalk and RCS safely fall back to the existing SMS sender", () => {
  assert.match(dispatch, /sendSmsDetailed\([\s\S]*?input\.to,[\s\S]*?input\.body,/);
  assert.match(dispatch, /policy\.primaryChannel === "RCS"/);
  assert.match(dispatch, /fallbackUsed/);
});

test("dispatch result exposes provider, identifiers, channels and estimated cost", () => {
  for (const field of [
    "provider",
    "requestedChannel",
    "actualChannel",
    "estimatedCostWon",
    "groupId",
    "messageId",
  ]) {
    assert.match(dispatch, new RegExp(field));
  }
  assert.match(sms, /groupId\?: string/);
  assert.match(sms, /messageId\?: string/);
});

test("legacy SMS public contracts remain available", () => {
  assert.match(sms, /export async function sendSmsDetailed/);
  assert.match(sms, /export async function sendSms\(/);
  assert.match(sms, /export async function sendSmsBulk/);
});

test("an explicitly requested LMS or LMS fallback can force the provider message type", () => {
  assert.match(dispatch, /textChannel === "LMS" \? \{ messageType: "LMS" \}/);
  assert.match(sms, /options\?\.messageType === "LMS"/);
  assert.match(sms, /type: messageType/);
});
