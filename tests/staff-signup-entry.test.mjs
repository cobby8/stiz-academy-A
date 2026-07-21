import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminActionSource = await readFile("src/app/actions/admin.ts", "utf8");
const inviteModalSource = await readFile("src/app/admin/staff/InviteStaffModal.tsx", "utf8");
const staffClientSource = await readFile("src/app/admin/staff/StaffClient.tsx", "utf8");
const installSource = await readFile("src/app/teacher-app/StaffAppInstallClient.tsx", "utf8");
const loginSource = await readFile("src/app/login/page.tsx", "utf8");
const smsSource = await readFile("src/lib/sms.ts", "utf8");

test("개인 초대 생성은 문자 결과와 무관하게 가입 링크를 관리자에게 반환한다", () => {
  assert.match(adminActionSource, /const smsResult = baseUrl[\s\S]*?await sendSmsDetailed/);
  assert.match(adminActionSource, /return \{[\s\S]*?token,[\s\S]*?inviteUrl,[\s\S]*?smsSent: smsResult\.ok/);
  assert.match(adminActionSource, /NEXT_PUBLIC_SITE_URL[\s\S]*?NEXT_PUBLIC_BASE_URL[\s\S]*?VERCEL_URL/);
  assert.match(adminActionSource, /data\.role !== "INSTRUCTOR"/);
  assert.match(adminActionSource, /\/\^010\\d\{8\}\$\//);
  assert.match(adminActionSource, /parsedUrl\.protocol !== "https:" \|\| isLocalHost/);
  assert.match(adminActionSource, /:\s*\{ ok: false, reason: SMS_SITE_URL_MISSING \}/);
  assert.doesNotMatch(smsSource, /body="\$\{body\}"/);
  assert.doesNotMatch(smsSource, /to=\$\{recipientNo\}/);
  assert.match(smsSource, /maskedRecipient/);
  assert.match(smsSource, /bodyLength=\$\{body\.length\}/);
});

test("관리자는 신규 초대와 대기 중 초대의 개인 가입 링크를 복사할 수 있다", () => {
  assert.match(inviteModalSource, /새 선생님 초대·가입/);
  assert.match(inviteModalSource, /개인 가입 링크/);
  assert.match(inviteModalSource, /navigator\.clipboard\.writeText\(absoluteInviteUrl\(result\.inviteUrl\)\)/);
  assert.match(inviteModalSource, /<AdminModal/);
  assert.match(inviteModalSource, /titleId="invite-staff-modal-title"/);
  assert.match(staffClientSource, /handleCopyInvitationLink\(inv\.token, inv\.name\)/);
  assert.match(staffClientSource, /가입 완료 선생님용 앱 설치 링크/);
});

test("공개 설치와 로그인 화면은 셀프가입 대신 개인 초대 가입을 안내한다", () => {
  assert.match(installSource, /가입을 마친 선생님 전용/);
  assert.match(installSource, /개인 초대 링크/);
  assert.match(loginSource, /이 화면에서는 선생님 계정을 새로 만들 수 없습니다/);
  assert.doesNotMatch(installSource, /초대.*전화번호.*조회/);
});
