import test from "node:test";
import assert from "node:assert/strict";
import { isExpiredMediaRevocationLease, mediaRevocationRetryDelayMs } from "../src/lib/mediaRevocationPolicy.ts";

test("회수 재시도 간격은 지수 증가하고 1시간을 넘지 않는다", () => {
  assert.equal(mediaRevocationRetryDelayMs(1), 30_000);
  assert.equal(mediaRevocationRetryDelayMs(2), 60_000);
  assert.ok(mediaRevocationRetryDelayMs(99) <= 3_600_000);
});

test("5분이 지난 처리 잠금은 다시 가져올 수 있다", () => {
  const now = Date.parse("2026-07-15T10:10:00Z");
  assert.equal(isExpiredMediaRevocationLease("2026-07-15T10:04:59Z", now), true);
  assert.equal(isExpiredMediaRevocationLease("2026-07-15T10:05:01Z", now), false);
  assert.equal(isExpiredMediaRevocationLease(null, now), true);
});
