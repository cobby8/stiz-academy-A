import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pushRoute = readFileSync(new URL("../src/app/api/push/route.ts", import.meta.url), "utf8");

test("푸시 구독 해제는 현재 로그인한 사용자 소유 구독만 삭제한다", () => {
  assert.match(pushRoute, /SELECT id FROM "User" WHERE email = \$1 LIMIT 1/);
  assert.match(pushRoute, /DELETE FROM "PushSubscription" WHERE endpoint = \$1 AND "userId" = \$2/);
  assert.doesNotMatch(pushRoute, /DELETE FROM "PushSubscription" WHERE endpoint = \$1`, endpoint\)/);
});
