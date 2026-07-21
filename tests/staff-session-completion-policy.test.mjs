import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/app/actions/staff-sessions.ts", import.meta.url), "utf8");

test("수업 종료 저장 뒤 학부모 알림 실패를 성공 응답과 분리한다", () => {
  const updateIndex = source.indexOf(`UPDATE "Session" SET status = 'COMPLETED'`);
  const notificationIndex = source.indexOf("getSessionParentRecipients(session)", updateIndex);

  assert.ok(updateIndex >= 0, "수업 종료 DB 갱신이 있어야 합니다.");
  assert.ok(notificationIndex > updateIndex, "학부모 알림은 종료 저장 뒤에 처리해야 합니다.");
  assert.match(source.slice(notificationIndex), /Promise\.allSettled/);
  assert.match(source.slice(notificationIndex), /catch \(error\)/);
  assert.match(source.slice(notificationIndex), /PARENT_NOTIFICATION_FAILED/);
  assert.match(source.slice(notificationIndex), /ok: true as const/);
});

test("이미 종료된 수업은 재시도해도 성공으로 응답한다", () => {
  assert.match(
    source,
    /session\.status === "COMPLETED"[\s\S]*?ok: true as const,[\s\S]*?resumed: true/,
  );
});
