import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePhotoManagement,
  isSinglePhotoDraft,
  sessionPhotoDeletionRetrySeconds,
  isValidQueuedSessionPhotoRef,
} from "../src/lib/sessionPhotoManagementPolicy.ts";

const privateReady = {
  draftStatus: "READY",
  visibility: "PRIVATE",
  hasPublishedCopy: false,
  hasGalleryPost: false,
  hasInstagramPost: false,
};

test("비공개 검토 사진은 수업 중 수정과 삭제를 허용한다", () => {
  assert.deepEqual(evaluatePhotoManagement(privateReady), {
    requiresDeletionQueue: false,
    canManage: true,
  });
});

test("공개 저장소 복사본이 생긴 사진은 직접 삭제하지 않는다", () => {
  assert.deepEqual(evaluatePhotoManagement({ ...privateReady, hasPublishedCopy: true }), {
    requiresDeletionQueue: true,
    canManage: false,
  });
});

test("갤러리 또는 인스타그램 게시 흔적이 있으면 삭제 대기열이 필요하다", () => {
  assert.equal(evaluatePhotoManagement({ ...privateReady, hasGalleryPost: true }).canManage, false);
  assert.equal(evaluatePhotoManagement({ ...privateReady, hasInstagramPost: true }).requiresDeletionQueue, true);
});

test("게시 처리 중 상태는 경쟁 삭제를 차단한다", () => {
  assert.equal(evaluatePhotoManagement({ ...privateReady, draftStatus: "PUBLISHING" }).canManage, false);
});

test("대상 학생 수정은 사진 한 장짜리 초안에서만 허용한다", () => {
  assert.equal(isSinglePhotoDraft(1), true);
  assert.equal(isSinglePhotoDraft(2), false);
  assert.equal(isSinglePhotoDraft(0), false);
});

test("저장소 삭제 실패는 지수 백오프로 재시도하되 한 시간으로 제한한다", () => {
  assert.equal(sessionPhotoDeletionRetrySeconds(1), 30);
  assert.equal(sessionPhotoDeletionRetrySeconds(2), 60);
  assert.equal(sessionPhotoDeletionRetrySeconds(20), 3600);
});

test("삭제 워커는 전용 비공개 버킷의 정규 수업 사진 경로만 허용한다", () => {
  const valid = "staff-sessions/class_1/session-2/123e4567-e89b-42d3-a456-426614174000.jpg";
  assert.equal(isValidQueuedSessionPhotoRef("staff-session-private", valid), true);
  assert.equal(isValidQueuedSessionPhotoRef("uploads", valid), false);
  assert.equal(isValidQueuedSessionPhotoRef("staff-session-private", "staff-sessions/class/session/../../secret.jpg"), false);
});
