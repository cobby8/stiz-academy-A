-- 담당 강사에게 신청 접수와 구분된 확정 정보를 전달한다.
INSERT INTO public."SmsTemplate" (
  trigger,
  name,
  target,
  body,
  "isActive",
  description,
  variables
)
VALUES
  (
    'TRIAL_SCHEDULED_COACH',
    '체험 일정 확정 (담당 강사)',
    'COACH',
    E'[STIZ] 체험수업 일정이 확정되었습니다.\n학생: {{childName}} ({{childGrade}})\n일시: {{scheduledDate}}\n반: {{className}}',
    true,
    '관리자가 체험 일정을 확정하면 담당 강사에게 확정 일시와 반을 안내',
    '["childName","childGrade","scheduledDate","className"]'
  ),
  (
    'ENROLL_APPROVED_COACH',
    '수강 승인 (담당 강사)',
    'COACH',
    E'[STIZ] 수강 신청이 승인되었습니다.\n학생: {{childName}} ({{childGrade}})\n배정 반: {{className}}',
    true,
    '관리자가 수강 신청을 승인하면 담당 강사에게 승인 사실과 배정 반을 안내',
    '["childName","childGrade","className"]'
  )
ON CONFLICT (trigger) DO NOTHING;

-- 메시지센터에서 새 템플릿을 즉시 켜고 끌 수 있도록 자동화 규칙도 함께 만든다.
INSERT INTO public."MessageAutomationRule" (
  trigger,
  name,
  "audienceScope",
  target,
  "isActive",
  "requestedChannel",
  "fallbackEnabled",
  "fallbackChannel",
  "templateId",
  description
)
SELECT
  t.trigger,
  t.name,
  'INTERNAL',
  t.target,
  t."isActive",
  'SMS',
  true,
  'SMS',
  t.id,
  t.description
FROM public."SmsTemplate" t
WHERE t.trigger IN ('TRIAL_SCHEDULED_COACH', 'ENROLL_APPROVED_COACH')
ON CONFLICT (trigger) DO UPDATE
SET "templateId" = COALESCE(
  public."MessageAutomationRule"."templateId",
  EXCLUDED."templateId"
);
