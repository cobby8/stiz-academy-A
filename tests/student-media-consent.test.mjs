import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMediaConsent, normalizeSubjectStudentIds } from "../src/lib/studentMediaConsentPolicy.ts";

const allowed = {
  studentId: "student-1",
  studentName: "홍길동",
  internalAllowed: true,
  galleryAllowed: true,
  instagramAllowed: true,
  revokedAt: null,
  isRelated: true,
};

test("갤러리는 내부 및 갤러리 동의가 모두 있어야 한다", () => {
  assert.equal(evaluateMediaConsent([allowed], "GALLERY").ok, true);
  assert.equal(evaluateMediaConsent([{ ...allowed, galleryAllowed: false }], "GALLERY").ok, false);
});

test("인스타그램은 세 범위 동의가 모두 있어야 한다", () => {
  const result = evaluateMediaConsent([{ ...allowed, instagramAllowed: false }], "INSTAGRAM");
  assert.equal(result.ok, false);
  assert.equal(result.blockedStudents[0].id, "student-1");
});

test("동의 철회는 모든 공개를 차단한다", () => {
  const result = evaluateMediaConsent([{ ...allowed, revokedAt: "2026-07-15T00:00:00Z" }], "GALLERY");
  assert.equal(result.ok, false);
  assert.equal(result.blockedStudents[0].reason, "동의 철회");
});

test("대상 학생을 확인할 수 없으면 안전하게 공개를 차단한다", () => {
  const result = evaluateMediaConsent([], "GALLERY");
  assert.equal(result.ok, false);
  assert.equal(result.studentCount, 0);
});

test("명시한 학생이 해당 수업 또는 반 소속이 아니면 차단한다", () => {
  const result = evaluateMediaConsent([{ ...allowed, isRelated: false }], "GALLERY");
  assert.equal(result.ok, false);
  assert.equal(result.blockedStudents[0].reason, "수업 또는 반 소속 불일치");
});

test("학생 ID는 중복과 비정상 값을 제거해 저장한다", () => {
  assert.deepEqual(normalizeSubjectStudentIds([" student-1 ", "student-1", "../bad", "student_2", 3]), [
    "student-1",
    "student_2",
  ]);
});
