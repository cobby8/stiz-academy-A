import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const form = fs.readFileSync("src/app/apply/enroll/EnrollApplicationForm.tsx", "utf8");
const steps = fs.readFileSync("src/app/apply/enroll/EnrollApplicationLaterSteps.tsx", "utf8");

test("정규 수강신청은 공용 지도 위치 선택기를 사용한다", () => {
  assert.match(steps, /LocationPickerModal/);
  assert.match(steps, /셔틀 탑승 위치 선택/);
  assert.match(steps, /셔틀 하차 위치 선택/);
  assert.match(steps, /min-h-11/);
});

test("셔틀 신청은 탑승·하차 좌표와 위치 동의를 모두 요구한다", () => {
  assert.match(form, /if \(!form\.shuttlePickupLocationData\)/);
  assert.match(form, /if \(!form\.shuttleDropoffLocationData\)/);
  assert.match(form, /if \(!form\.shuttleLocationConsent\)/);
  assert.match(form, /SHUTTLE_LOCATION_CONSENT_VERSION/);
});

test("수정 신청은 현재 버전으로 실제 동의한 경우에만 위치 동의를 복원한다", () => {
  assert.match(form, /existing\.shuttleLocationConsent === true/);
  assert.match(
    form,
    /existing\.shuttleLocationConsentVersion === SHUTTLE_LOCATION_CONSENT_VERSION/,
  );
});

test("직접 주소 수정과 미탑승 전환은 기존 좌표를 폐기한다", () => {
  assert.match(steps, /update\("shuttlePickupLocationData", undefined\)/);
  assert.match(steps, /update\("shuttleDropoffLocationData", undefined\)/);
  assert.match(steps, /update\("shuttleLocationConsent", false\)/);
});

test("확인 화면에는 주소만 표시하고 위경도 숫자는 노출하지 않는다", () => {
  const summary = steps.slice(steps.indexOf('{step === 4'));
  assert.match(summary, /value=\{form\.shuttlePickup\}/);
  assert.match(summary, /value=\{form\.shuttleDropoff\}/);
  assert.doesNotMatch(summary, /latitude|longitude|accuracyMeters/);
});
