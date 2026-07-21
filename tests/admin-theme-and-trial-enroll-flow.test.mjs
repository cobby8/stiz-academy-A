import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminShell = readFileSync(new URL("../src/app/admin/AdminShellClient.tsx", import.meta.url), "utf8");
const themeToggle = readFileSync(new URL("../src/components/ThemeToggle.tsx", import.meta.url), "utf8");
const publicActions = readFileSync(new URL("../src/app/actions/public.ts", import.meta.url), "utf8");
const enrollForm = readFileSync(new URL("../src/app/apply/enroll/EnrollApplicationForm.tsx", import.meta.url), "utf8");
const trialClient = readFileSync(new URL("../src/app/admin/trial/TrialCrmClient.tsx", import.meta.url), "utf8");

test("관리자 헤더는 알림 옆에 해와 달 아이콘 테마 전환을 둔다", () => {
  assert.match(adminShell, /import \{ ThemeToggle \} from "@\/components\/ThemeToggle"/);
  assert.match(adminShell, /<LazyNotificationBell \/>\s*<ThemeToggle \/>/);
  assert.match(themeToggle, /resolvedTheme/);
  assert.match(themeToggle, /라이트 모드로 변경/);
  assert.match(themeToggle, /다크 모드로 변경/);
  assert.match(themeToggle, /isDark \? "light_mode" : "dark_mode"/);
});

test("체험 완료 후 수강신청서 링크는 관리자 주요 액션으로 노출된다", () => {
  assert.match(trialClient, /function renderEnrollGuideButton/);
  assert.match(trialClient, /lead\.status !== "ATTENDED"/);
  assert.match(trialClient, /lead\.enrollApplicationReceivedAt/);
  assert.match(trialClient, /handleSendEnrollGuide\(lead\)/);
  assert.match(trialClient, /수강신청 안내/);
  assert.match(trialClient, /안내 재발송/);
  assert.match(trialClient, /직접 등록/);
});

test("체험 신청 정보는 수강신청서 자동 채움으로 이어진다", () => {
  for (const field of ["childSchool", "childPhone", "basketballExp", "preferredSlotKey"]) {
    assert.match(publicActions, new RegExp(`${field}: string \\| null`));
    assert.match(publicActions, new RegExp(`"${field}"`));
  }
  assert.match(publicActions, /ADD COLUMN IF NOT EXISTS "childPhone" TEXT/);
  assert.match(publicActions, /parentName === "미입력" \? "" : parentName/);
  assert.match(enrollForm, /const preferredTrialSlot = trialData\?\.preferredSlotKey/);
  assert.match(enrollForm, /const trialChildPhone = trialData\?\.childPhone \|\| trialData\?\.parentPhone \|\| ""/);
  assert.match(enrollForm, /childSchool: trialData\?\.childSchool \|\| ""/);
  assert.match(enrollForm, /childPhone: trialChildPhone/);
  assert.match(enrollForm, /preferredSlotKeys: preferredTrialSlot \? \[preferredTrialSlot\] : \[\]/);
  assert.match(enrollForm, /basketballExp: trialData\?\.basketballExp \|\| ""/);
});
