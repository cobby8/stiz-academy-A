import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("체험 일정 확정 강사 문자는 학생·확정 일시·반을 안내한다", () => {
  const templates = read("src/lib/smsTemplate.ts");

  assert.match(templates, /"TRIAL_SCHEDULED_COACH"/);
  assert.match(
    templates,
    /체험수업 일정이 확정되었습니다\.\\n학생: \{\{childName\}\} \(\{\{childGrade\}\}\)\\n일시: \{\{scheduledDate\}\}\\n반: \{\{className\}\}/,
  );
});

test("수강 승인 강사 문자는 학생·승인 사실·배정 반을 안내한다", () => {
  const templates = read("src/lib/smsTemplate.ts");

  assert.match(templates, /"ENROLL_APPROVED_COACH"/);
  assert.match(
    templates,
    /수강 신청이 승인되었습니다\.\\n학생: \{\{childName\}\} \(\{\{childGrade\}\}\)\\n배정 반: \{\{className\}\}/,
  );
});

test("기존 운영 DB용 마이그레이션은 템플릿과 내부 자동화 규칙을 함께 추가한다", () => {
  const migration = read(
    "prisma/migrations/20260723223000_add_coach_confirmation_sms_templates/migration.sql",
  );

  assert.match(migration, /INSERT INTO public\."SmsTemplate"/);
  assert.match(migration, /TRIAL_SCHEDULED_COACH/);
  assert.match(migration, /ENROLL_APPROVED_COACH/);
  assert.match(migration, /INSERT INTO public\."MessageAutomationRule"/);
  assert.match(migration, /'INTERNAL'/);
  assert.match(migration, /ON CONFLICT \(trigger\) DO UPDATE/);
});

test("런타임 seed도 기존 DB에 새 자동화 규칙을 보완한다", () => {
  const templates = read("src/lib/smsTemplate.ts");

  assert.match(templates, /ON CONFLICT \(trigger\) DO NOTHING/);
  assert.match(templates, /INSERT INTO "MessageAutomationRule"/);
  assert.match(templates, /FROM "SmsTemplate" t/);
});
