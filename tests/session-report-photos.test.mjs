import assert from "node:assert/strict";
import test from "node:test";
import {
  appendSessionPhotoUrls,
  parseSessionPhotoEntries,
  removeSessionPhotoEntryAt,
  toSessionReportPhotoViews,
} from "../src/lib/sessionPhotoEntries.ts";

const SESSION_ID = "session-1";

// 선생님 앱이 저장하는 비공개 사진 객체
const privatePhoto = {
  id: "photo-a",
  type: "image",
  url: "/api/staff/sessions/session-1/photos/photo-a",
  storageBucket: "staff-session-private",
  storagePath: "staff-sessions/class-1/session-1/photo-a.jpg",
  visibility: "PRIVATE",
};

const publicPhoto = {
  id: "photo-b",
  type: "image",
  url: "https://cdn.example.com/uploads/class-logs/photo-b.jpg",
  storageBucket: "uploads",
  storagePath: "class-logs/photo-b.jpg",
  visibility: "PUBLIC",
};

test("문자열 배열은 그대로 표시된다", () => {
  const json = JSON.stringify(["https://cdn.example.com/a.jpg", "/uploads/class-logs/b.jpg"]);
  assert.deepEqual(toSessionReportPhotoViews(json, SESSION_ID), [
    { index: 0, src: "https://cdn.example.com/a.jpg", isPrivate: false },
    { index: 1, src: "/uploads/class-logs/b.jpg", isPrivate: false },
  ]);
});

test("객체 배열은 [object Object]가 아니라 실제 주소로 변환된다", () => {
  const views = toSessionReportPhotoViews(JSON.stringify([privatePhoto, publicPhoto]), SESSION_ID);
  assert.deepEqual(views, [
    { index: 0, src: "/api/staff/sessions/session-1/photos/photo-a", isPrivate: true },
    { index: 1, src: "https://cdn.example.com/uploads/class-logs/photo-b.jpg", isPrivate: false },
  ]);
  assert.equal(views.some((view) => view.src.includes("[object Object]")), false);
});

test("비공개 사진은 공개 주소가 아니라 권한 검사 프록시 경로로만 노출한다", () => {
  const leaked = { ...privatePhoto, url: "https://cdn.example.com/staff-session-private/leak.jpg" };
  const [view] = toSessionReportPhotoViews(JSON.stringify([leaked]), SESSION_ID);
  assert.equal(view.src, "/api/staff/sessions/session-1/photos/photo-a");
  assert.equal(view.isPrivate, true);
});

test("문자열로 저장된 비공개 프록시 경로도 비공개로 인식한다", () => {
  const [view] = toSessionReportPhotoViews(JSON.stringify(["/api/staff/sessions/session-1/photos/photo-a"]), SESSION_ID);
  assert.equal(view.isPrivate, true);
});

test("문자열과 객체가 섞인 배열도 순서대로 모두 표시된다", () => {
  const json = JSON.stringify(["https://cdn.example.com/a.jpg", privatePhoto, publicPhoto]);
  assert.deepEqual(toSessionReportPhotoViews(json, SESSION_ID).map((view) => view.src), [
    "https://cdn.example.com/a.jpg",
    "/api/staff/sessions/session-1/photos/photo-a",
    "https://cdn.example.com/uploads/class-logs/photo-b.jpg",
  ]);
});

test("깨진 값이나 빈 문자열은 화면에서 제외한다", () => {
  assert.deepEqual(toSessionReportPhotoViews("not-json", SESSION_ID), []);
  assert.deepEqual(toSessionReportPhotoViews(null, SESSION_ID), []);
  assert.deepEqual(toSessionReportPhotoViews(JSON.stringify(["  ", { id: 1 }]), SESSION_ID), []);
});

test("삭제는 지정한 위치 항목만 없애고 남은 항목의 형태를 보존한다", () => {
  const json = JSON.stringify(["https://cdn.example.com/a.jpg", privatePhoto, publicPhoto]);
  const next = removeSessionPhotoEntryAt(json, 1);
  assert.deepEqual(JSON.parse(next), ["https://cdn.example.com/a.jpg", publicPhoto]);

  const removedString = removeSessionPhotoEntryAt(json, 0);
  assert.deepEqual(JSON.parse(removedString), [privatePhoto, publicPhoto]);
});

test("표시 순서의 index로 삭제하면 정확히 그 사진이 지워진다", () => {
  const json = JSON.stringify([privatePhoto, "https://cdn.example.com/a.jpg", publicPhoto]);
  const views = toSessionReportPhotoViews(json, SESSION_ID);
  const target = views.find((view) => view.src === "https://cdn.example.com/a.jpg");
  assert.deepEqual(JSON.parse(removeSessionPhotoEntryAt(json, target.index)), [privatePhoto, publicPhoto]);
});

test("모두 삭제하면 빈 배열 JSON이 된다", () => {
  assert.equal(removeSessionPhotoEntryAt(JSON.stringify([privatePhoto]), 0), "[]");
});

test("사진 추가는 기존 객체 항목을 훼손하지 않고 뒤에 붙인다", () => {
  const json = JSON.stringify([privatePhoto]);
  const next = appendSessionPhotoUrls(json, ["https://cdn.example.com/new.jpg", "   ", ""]);
  assert.deepEqual(JSON.parse(next), [privatePhoto, "https://cdn.example.com/new.jpg"]);
});

test("빈 photosJSON에서도 사진 추가가 동작한다", () => {
  assert.deepEqual(JSON.parse(appendSessionPhotoUrls("[]", ["https://cdn.example.com/new.jpg"])), [
    "https://cdn.example.com/new.jpg",
  ]);
  assert.deepEqual(JSON.parse(appendSessionPhotoUrls(null, ["https://cdn.example.com/new.jpg"])), [
    "https://cdn.example.com/new.jpg",
  ]);
});

test("파서는 기존 계약대로 문자열과 사진 객체만 통과시킨다", () => {
  const entries = parseSessionPhotoEntries(JSON.stringify(["a", privatePhoto, { id: "x" }, null, 3]));
  assert.deepEqual(entries, ["a", privatePhoto]);
});
