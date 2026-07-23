import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const staffClientSource = await readFile("src/app/admin/staff/StaffClient.tsx", "utf8");
const queriesSource = await readFile("src/lib/queries.ts", "utf8");
const adminActionSource = await readFile("src/app/actions/admin.ts", "utf8");
const inviteActionSource = await readFile("src/app/actions/invite.ts", "utf8");
const linkSource = await readFile("src/lib/staff-coach-link.ts", "utf8");

test("staff coach link selector is visible for admin, vice admin, and instructors", () => {
  assert.match(staffClientSource, /user\.role === "ADMIN"[\s\S]*user\.role === "VICE_ADMIN"[\s\S]*user\.role === "INSTRUCTOR"/);
  assert.match(staffClientSource, /canLinkCoach \?/);
  assert.match(staffClientSource, /handleCoachLink\(user\.id, e\.target\.value\)/);
});

test("스태프 관리 화면은 앱 계정과 별도로 코치 프로필 목록을 보여준다", () => {
  assert.match(staffClientSource, /코치 프로필/);
  assert.match(staffClientSource, /coaches\.map\(\(coach\)/);
  assert.match(staffClientSource, /앱 연결됨/);
  assert.match(staffClientSource, /앱 미연결/);
  assert.match(queriesSource, /SELECT id, name, role, phone, "userId"/);
});

test("만료된 스태프 초대도 이력에서 재발송할 수 있다", () => {
  assert.match(staffClientSource, /pastInvitations\.slice\(0, 20\)\.map/);
  assert.match(staffClientSource, /inv\.status === "PENDING"/);
  assert.match(staffClientSource, /handleResendInvitation\(inv\.id, inv\.name\)/);
});

test("스태프 가입과 직접 추가는 기존 코치 프로필을 자동 연결한다", () => {
  assert.match(linkSource, /input\.role !== "INSTRUCTOR"/);
  assert.match(linkSource, /regexp_replace\(COALESCE\(phone, ''\)/);
  assert.match(linkSource, /lower\(trim\(name\)\) = lower\(trim\(\$3\)\)/);
  assert.match(adminActionSource, /linkMatchingCoachProfileToUser\(tx/);
  assert.match(inviteActionSource, /linkMatchingCoachProfileToUser\(tx/);
});
