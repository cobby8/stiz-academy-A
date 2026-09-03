import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import { kakaoGuestEntry } from "../src/lib/kakao-guest-entry.ts";

test("공개 메뉴는 인증 링크 없이 실제 신청 페이지를 안내한다", () => {
  const result = kakaoGuestEntry("메뉴", "https://example.test");
  const buttons = result.template.outputs[0].basicCard.buttons;
  assert.equal(buttons.length, 3);
  for (const button of buttons) {
    const path = new URL(button.webLinkUrl).pathname;
    assert.ok(existsSync(`src/app${path}/page.tsx`));
  }
  assert.match(result.template.outputs[0].basicCard.description, /상담이 접수되지는 않습니다/);
});
test("신규·체험·상담은 공개 링크, 기존 학생 요청은 인증 선택 안내", () => {
  for (const text of ["체험 문의", "수강 신청", "상담 안내", "오늘 결석", "메뉴"]) assert.ok(kakaoGuestEntry(text, "https://example.test"));
  assert.equal(kakaoGuestEntry("기존 수강생 인증", "https://example.test"), null);
});
test("미인증 메뉴는 identity 생성 전 반환하고 기존 인증 흐름은 유지한다", () => {
  const route = readFileSync("src/app/api/kakao/chatbot/skill/route.ts", "utf8");
  assert.ok(route.indexOf("if (guestResponse)") < route.indexOf("await issueLink"));
  assert.match(route, /identity.status !== "ACTIVE"/);
  assert.match(route, /handleLinkedMessage\(identity, utterance, requestId\)/);
});
