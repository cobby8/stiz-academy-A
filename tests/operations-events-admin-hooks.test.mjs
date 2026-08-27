import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { buildEnrollmentOperationsEvent } from "../src/lib/operations-events/admin-hooks.ts";

const BASE = {
  enrollmentId: "enrollment-1",
  changedAt: new Date("2026-08-31T15:10:00.000Z"),
  actorUserId: "admin-1",
  studentId: "student-1",
  studentName: "박찬민",
  classId: "adult-tue",
  className: "화요일 성인반",
};

test("신규 등록은 한국 날짜의 수강 추가 이벤트가 된다", () => {
  const event = buildEnrollmentOperationsEvent({ ...BASE, previousStatus: null, nextStatus: "ACTIVE" });
  assert.equal(event?.kind, "CLASS_ADD");
  assert.equal(event?.eventType, "ENROLLMENT_CREATED");
  assert.equal(event?.effectiveDate, "2026-09-01");
  assert.deepEqual(
    { toClassId: event?.after.toClassId, parentConfirmed: event?.after.parentConfirmed },
    { toClassId: "adult-tue", parentConfirmed: true },
  );
});

test("휴원생 활성화는 복귀, 활성생 퇴원은 퇴원 이벤트가 된다", () => {
  assert.equal(buildEnrollmentOperationsEvent({ ...BASE, previousStatus: "PAUSED", nextStatus: "ACTIVE" })?.kind, "RESUME");
  const withdrawn = buildEnrollmentOperationsEvent({ ...BASE, previousStatus: "ACTIVE", nextStatus: "WITHDRAWN" });
  assert.equal(withdrawn?.kind, "WITHDRAW");
  assert.equal(withdrawn?.after.fromClassId, "adult-tue");
});

test("같은 상태를 다시 저장하면 동기화 이벤트를 만들지 않는다", () => {
  assert.equal(buildEnrollmentOperationsEvent({ ...BASE, previousStatus: "ACTIVE", nextStatus: "ACTIVE" }), null);
});

test("등록·상태변경은 같은 트랜잭션에서 원장을 만들고 하드삭제는 자동 동기화하지 않는다", () => {
  const source = fs.readFileSync(new URL("../src/app/actions/admin.ts", import.meta.url), "utf8");
  const enroll = source.slice(source.indexOf("export async function enrollStudent"), source.indexOf("export async function updateEnrollmentStatus"));
  const status = source.slice(source.indexOf("export async function updateEnrollmentStatus"), source.indexOf("export async function deleteEnrollment"));
  const hardDelete = source.slice(source.indexOf("export async function deleteEnrollment"), source.indexOf("// ── 출결 관리"));

  for (const action of [enroll, status]) {
    assert.match(action, /prisma\.\$transaction/);
    assert.match(action, /enqueueWebsiteOperationsEventInTransaction\(tx, event\)/);
  }
  assert.doesNotMatch(hardDelete, /enqueueWebsiteOperationsEvent/);
  assert.doesNotMatch(hardDelete, /DELETE FROM "Enrollment"/);
  assert.match(hardDelete, /updateEnrollmentStatus\(enrollmentId, "WITHDRAWN"\)/);
});

test("동일 상태는 UPDATE·UPSERT보다 먼저 반환해 updatedAt도 보존한다", () => {
  const source = fs.readFileSync(new URL("../src/app/actions/admin.ts", import.meta.url), "utf8");
  const enroll = source.slice(source.indexOf("export async function enrollStudent"), source.indexOf("export async function updateEnrollmentStatus"));
  const status = source.slice(source.indexOf("export async function updateEnrollmentStatus"), source.indexOf("export async function deleteEnrollment"));

  const activeNoOp = enroll.indexOf('existingEnrollment?.status === "ACTIVE"');
  const enrollmentUpsert = enroll.indexOf('INSERT INTO "Enrollment"');
  assert.ok(activeNoOp >= 0 && activeNoOp < enrollmentUpsert, "ACTIVE 등록은 UPSERT 전에 반환해야 합니다.");

  const statusNoOp = status.indexOf("before.previousStatus === status");
  const statusUpdate = status.indexOf('UPDATE "Enrollment" SET status=$1');
  assert.ok(statusNoOp >= 0 && statusNoOp < statusUpdate, "동일 상태 저장은 UPDATE 전에 반환해야 합니다.");
});
