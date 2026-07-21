import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./SeasonalAdminClient.tsx", import.meta.url), "utf8");

test("special lecture class form saves operation settings and every session", () => {
  assert.match(source, /name="linkedClassId"/);
  assert.match(source, /name="linkedProgramId"/);
  assert.match(source, /name="instructorId"/);
  assert.match(source, /name="shuttleAvailable"/);
  assert.match(source, /name="status" defaultValue=\{initial\?\.status \?\? "DRAFT"\}/);
  assert.match(source, /sessionDates,/);
  assert.match(source, /회차 추가/);
  assert.doesNotMatch(source, /existingApplicantPrice[^\n]+status: "DRAFT"/);
});

test("시즌과 반 수정 폼은 기존 값을 입력 기본값으로 보존한다", () => {
  assert.match(source, /defaultValue:initial\?\.name/);
  assert.match(source, /defaultValue:initial\?\.slug/);
  assert.match(source, /defaultValue:dateInputValue\(initial\?\.enrollmentStartsAt\)/);
  assert.match(source, /defaultValue=\{initial\?\.targetGrades \?\? initial\?\.targetGrade\}/);
  assert.match(source, /defaultValue=\{initial\?\.price\}/);
  assert.match(source, /defaultValue=\{field\.defaultValue \?\? ""\}/);
});

test("신청 상세와 폼 모달은 공통 접근성 모달을 사용한다", () => {
  assert.match(source, /<AdminModal onClose=\{onClose\} titleId="application-title"/);
  assert.match(source, /<AdminModal onClose=\{\(\) => \{ if \(!pending\) onClose\(\); \}\} titleId=\{titleId\}>/);
  assert.match(source, /data-admin-modal-initial-focus/);
});

test("셔틀 신청 상세는 지도 좌표와 기존 텍스트 위치를 모두 표시한다", () => {
  assert.match(source, /pickupLatitude\?: number \| string \| null/);
  assert.match(source, /dropoffLongitude\?: number \| string \| null/);
  assert.match(source, /텍스트 신청 · 위치 확인 필요/);
  assert.match(source, /지도 핀 제출 · 관리자 확인 필요/);
  assert.match(source, /pickupAccuracyMeters/);
  assert.match(source, /pickupConfirmedAt/);
  assert.match(source, /request\.pickupLocation/);
});

test("셔틀 위치는 별도 지도 SDK 없이 외부 지도에서 열 수 있다", () => {
  assert.match(source, /https:\/\/map\.kakao\.com\/link\/map/);
  assert.match(source, /https:\/\/map\.naver\.com\/p\?c=/);
  assert.match(source, /target="_blank" rel="noreferrer"/);
  assert.match(source, /위치 정확도/);
  assert.match(source, /locationConsentVersion/);
});
