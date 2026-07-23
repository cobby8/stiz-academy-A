import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildNoShowEventId,
  isSafeShuttleSmsRetry,
} from "../src/lib/shuttle/notification-policy.js";

const notifications = await readFile(new URL("../src/lib/shuttle/notifications.ts", import.meta.url), "utf8");
const service = await readFile(new URL("../src/lib/shuttle/service.ts", import.meta.url), "utf8");

test("route confirmation sends only after the serializable transaction commits", () => {
  assert.match(service, /const route = await prisma\.\$transaction[\s\S]*?await notifyShuttleRouteConfirmed\(route\.id\);[\s\S]*?return route;/);
  assert.match(notifications, /"SHUTTLE_ROUTE_CONFIRMED"/);
  assert.match(notifications, /`route:\$\{route\.id\}:v\$\{route\.version\}:passenger:\$\{passenger\.logicalKey\}`/);
  assert.match(notifications, /deliveryRunId: "safe-retry-1"/);
});

test("route revisions compare the previous version using stable passenger keys", () => {
  assert.match(notifications, /route\.previousVersionId/);
  assert.match(notifications, /special:\$\{passenger\.shuttleRequestId\}/);
  assert.match(notifications, /regular:\$\{passenger\.studentId\}:\$\{passenger\.sessionId\}:\$\{passenger\.locationKind\}/);
  assert.match(notifications, /noticeFingerprint/);
  assert.match(notifications, /previousByKey\.get\(passenger\.logicalKey\) !==/);
});

test("no-show sends once per transition and other ride statuses do not send", () => {
  assert.match(service, /before\.rideStatus !== "NO_SHOW" && status === "NO_SHOW"/);
  assert.match(service, /await notifyShuttlePassengerNoShow\(routeId, passengerId\)/);
  assert.match(notifications, /"SHUTTLE_PASSENGER_NO_SHOW"/);
  assert.match(notifications, /logicalPassengerKey\(passenger\)/);
  assert.match(notifications, /buildNoShowEventId\(/);
  assert.doesNotMatch(notifications, /eventId: `route:\$\{routeId\}:passenger:\$\{passengerId\}:no-show`/);
});

test("SMS notices use snapshot phones only and isolate delivery failures", () => {
  assert.match(notifications, /normalizePhone\(passenger\.parentPhoneSnapshot\)/);
  assert.doesNotMatch(notifications, /parentId|User|Student/);
  assert.match(notifications, /Promise\.allSettled/);
  assert.match(notifications, /catch \(error\)/);
  assert.match(notifications, /timeZone: KOREA_TIME_ZONE/);
  assert.match(notifications, /else if \(!result\.value\.ok\)/);
  assert.match(notifications, /if \(first\.ok\) return first/);
  assert.match(notifications, /deliveryRunId: "safe-retry-1"/);
});

test("no-show dedupe key remains stable across physical route revisions", () => {
  const firstRevision = buildNoShowEventId("regular:student-1:session-1:PICKUP", "2026-07-24", "PICKUP");
  const nextRevision = buildNoShowEventId("regular:student-1:session-1:PICKUP", "2026-07-24", "PICKUP");
  assert.equal(firstRevision, nextRevision);
  assert.equal(firstRevision, "no-show:regular:student-1:session-1:PICKUP:2026-07-24:PICKUP");
  assert.doesNotMatch(firstRevision, /passenger-|route-/);
});

test("automatic retry is limited to explicit provider rejection", () => {
  assert.equal(isSafeShuttleSmsRetry({ ok: false, reason: "Solapi failed: rejected" }), true);
  assert.equal(isSafeShuttleSmsRetry({ ok: false, reason: "Bizppurio failed: rejected" }), true);
  assert.equal(isSafeShuttleSmsRetry({ ok: false, reason: "SMS request failed: This operation was aborted" }), false);
  assert.equal(isSafeShuttleSmsRetry({ ok: false, reason: "문자 발송이 처리 중이거나 결과 확인이 필요합니다." }), false);
  assert.equal(isSafeShuttleSmsRetry({ ok: false, reason: "Solapi failed: rejected", messageId: "accepted-id" }), false);
  assert.equal(isSafeShuttleSmsRetry({ ok: true }), false);
});
