import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync("src/app/admin/seasonal/SeasonalAdminClient.tsx", "utf8");

test("공개 모집 반의 출석 준비 누락을 카드와 폼에서 안내한다", () => {
  assert.match(client, /function missingAttendancePreparation/);
  assert.match(client, /selected\.status === "PUBLISHED" && klass\.status === "OPEN"/);
  assert.match(client, /출석 준비 미완료/);
  assert.match(client, /빠진 항목: \{attendanceMissing\.join\(" · "\)\}/);
  assert.match(client, /모집 상태로 저장할 수 있지만 수업 시작 전 연결해 주세요/);
  assert.match(client, /<Icon name="warning" \/>/);
});

test("모집 마감 뒤에도 편집 폼에서 출석 준비 경고를 유지한다", () => {
  assert.match(client, /\["OPEN", "CLOSED"\]\.includes\(attendanceReadiness\.status\)/);
});
