import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const picker = fs.readFileSync("src/components/maps/LocationPickerModal.tsx", "utf8");
const shuttleAdmin = fs.readFileSync("src/app/admin/shuttle/ShuttleRouteAdminClient.tsx", "utf8");

test("location picker starts near Dasan instead of Seoul city hall", () => {
  assert.match(picker, /DEFAULT_MAP_CENTER = \{ latitude: 37\.624, longitude: 127\.151 \}/);
  assert.doesNotMatch(picker, /37\.5665/);
});

test("location picker shows a pending state while saving", () => {
  assert.match(picker, /confirmPending = false/);
  assert.match(picker, /aria-busy=\{confirmPending\}/);
  assert.match(picker, /confirmPending \? "저장 중\.\.\." : "이 위치로 선택"/);
  assert.match(shuttleAdmin, /confirmPending=\{pending\}/);
});
