import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const picker = fs.readFileSync("src/components/maps/LocationPickerModal.tsx", "utf8");
const shuttleAdmin = fs.readFileSync("src/app/admin/shuttle/ShuttleRouteAdminClient.tsx", "utf8");

test("location picker starts near Dasan instead of Seoul city hall", () => {
  assert.match(picker, /DEFAULT_MAP_CENTER = \{ latitude: 37\.624, longitude: 127\.151 \}/);
  assert.doesNotMatch(picker, /37\.5665/);
});

test("location picker shows clear states while saving or locating", () => {
  assert.match(picker, /confirmPending = false/);
  assert.match(picker, /isLocating/);
  assert.match(picker, /aria-busy=\{confirmPending \|\| isLocating\}/);
  assert.match(picker, /confirmPending \? "저장 중\.\.\." : isLocating \? "현재 위치 확인 중\.\.\." : location \? "이 위치로 선택" : "위치 선택 필요"/);
  assert.match(shuttleAdmin, /confirmPending=\{pending\}/);
});

test("location picker explains why confirm cannot save without coordinates", () => {
  assert.match(picker, /function confirmSelection/);
  assert.match(picker, /현재 위치 확인이 끝나거나 지도를 움직여 위치를 선택해주세요/);
  assert.match(picker, /현재 위치를 확인하고 있습니다\. 잠시 후 다시 눌러주세요/);
  assert.doesNotMatch(picker, /disabled=\{!location \|\| confirmPending\}/);
});
