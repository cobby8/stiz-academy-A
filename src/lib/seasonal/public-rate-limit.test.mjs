import assert from "node:assert/strict";
import test from "node:test";

import {
  clientIpKey,
  hashSensitiveRateLimitKey,
  resetPublicRateLimitsForTests,
  takePublicRateLimit,
} from "./public-rate-limit.ts";

test.beforeEach(() => resetPublicRateLimitsForTests());

test("정해진 횟수 뒤 요청을 차단하고 Retry-After를 계산한다", () => {
  assert.equal(takePublicRateLimit("a", { limit: 2, windowMs: 10_000, now: 1_000 }).allowed, true);
  assert.equal(takePublicRateLimit("a", { limit: 2, windowMs: 10_000, now: 2_000 }).allowed, true);
  const blocked = takePublicRateLimit("a", { limit: 2, windowMs: 10_000, now: 3_000 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 8);
});

test("제한 시간이 지나면 새 창으로 초기화한다", () => {
  takePublicRateLimit("a", { limit: 1, windowMs: 1_000, now: 1_000 });
  assert.equal(takePublicRateLimit("a", { limit: 1, windowMs: 1_000, now: 2_000 }).allowed, true);
});

test("프록시 헤더에서 첫 IP만 제한 키로 사용한다", () => {
  const request = new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } });
  assert.equal(clientIpKey(request), "203.0.113.7");
});

test("민감값은 원문이 아닌 안정적인 해시 키로 바꾼다", () => {
  const first = hashSensitiveRateLimitKey("01012345678");
  assert.equal(first, hashSensitiveRateLimitKey("01012345678"));
  assert.notEqual(first, hashSensitiveRateLimitKey("01099999999"));
  assert.equal(first.includes("01012345678"), false);
});
