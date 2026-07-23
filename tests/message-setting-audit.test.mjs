import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("자동발송 정책 변경은 관리자와 변경 전후 값을 같은 거래에 기록한다", () => {
  const route = read("src/app/api/admin/sms/automations/[id]/route.ts");

  assert.match(route, /admin = await requireAdmin\(\)/);
  assert.match(route, /prisma\.\$transaction/);
  assert.match(route, /FOR UPDATE/);
  assert.match(route, /INSERT INTO "MessageSettingAuditLog"/);
  assert.match(route, /'AUTOMATION_RULE'/);
  assert.match(route, /admin\.appUserId/);
  assert.match(route, /admin\.appUserName/);
  assert.match(route, /safePolicy/);
});

test("템플릿 변경과 초기화는 본문 대신 SHA-256 해시를 감사 기록에 남긴다", () => {
  const actions = read("src/app/actions/admin.ts");
  const templateSection = actions.slice(
    actions.indexOf("export async function updateSmsTemplate"),
    actions.indexOf("// ?먥븧", actions.indexOf("export async function resetSmsTemplate")),
  );

  assert.match(templateSection, /const admin = await requireAdmin\(\)/);
  assert.match(templateSection, /createHash\("sha256"\)/);
  assert.match(templateSection, /bodyHash/);
  assert.match(templateSection, /INSERT INTO "MessageSettingAuditLog"/);
  assert.match(templateSection, /'TEMPLATE'/);
  assert.match(templateSection, /'RESET'/);
  assert.match(templateSection, /'RESET_TO_DEFAULT'/);
  assert.doesNotMatch(templateSection, /body:\s*template\.body/);
});

test("감사 테이블이 아직 배포되지 않았으면 설정 변경을 중단한다", () => {
  const route = read("src/app/api/admin/sms/automations/[id]/route.ts");
  const actions = read("src/app/actions/admin.ts");

  assert.match(route, /Message settings migration is required/);
  assert.match(actions, /문자 설정 DB 업데이트가 필요합니다/);
  assert.doesNotMatch(actions, /await updateTemplate\(prisma\)/);
  assert.doesNotMatch(actions, /await resetTemplate\(prisma\)/);
});

test("audit infrastructure is checked before template seeding", () => {
  const actions = read("src/app/actions/admin.ts");
  for (const functionName of ["updateSmsTemplate", "resetSmsTemplate"]) {
    const start = actions.indexOf(`export async function ${functionName}`);
    const section = actions.slice(start, start + 1400);
    assert.ok(
      section.indexOf("requireMessageSettingAuditInfrastructure")
        < section.indexOf("ensureSmsTemplates"),
    );
  }
});
