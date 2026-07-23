import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const chatRoute = readFileSync(new URL("../src/app/api/chat/route.ts", import.meta.url), "utf8");

test("챗봇은 질문 의도에 따라 필요한 컨텍스트를 고른다", () => {
  assert.match(chatRoute, /function inferChatContextNeeds/);
  assert.match(chatRoute, /const contextNeeds = inferChatContextNeeds\(messages\)/);
  assert.match(chatRoute, /asksShuttle/);
  assert.match(chatRoute, /asksCoach/);
  assert.match(chatRoute, /asksGrade/);
});

test("챗봇은 모든 DB 컨텍스트를 매번 읽지 않는다", () => {
  assert.match(chatRoute, /contextNeeds\.programs \? getCachedPrograms\(\) : Promise\.resolve\(\[\]\)/);
  assert.match(chatRoute, /contextNeeds\.shuttle \? getCachedRoutes\(\) : Promise\.resolve\(\[\]\)/);
  assert.match(chatRoute, /contextNeeds\.notices \? getCachedNotices\(\) : Promise\.resolve\(\[\]\)/);
  assert.match(chatRoute, /contextNeeds\.slotGrades \? getCachedSlotGrades\(\) : Promise\.resolve\(EMPTY_SLOT_GRADES\)/);
});
