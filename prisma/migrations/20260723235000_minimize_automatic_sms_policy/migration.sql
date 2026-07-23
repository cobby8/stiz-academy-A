-- 최소 자동문자 정책
-- 최초 신청은 관리자에게 한 번 알리고, 신청자 접수 확인/배정 전 강사/체험 감사 문자는 기본 중단한다.
-- 인증번호(SECURITY_PHONE_OTP)는 이 정책의 대상이 아니다.

INSERT INTO public."SmsTemplate" (
  trigger, name, target, body, "isActive", description, variables
)
VALUES (
  'SPECIAL_APPLICATION_NEW_ADMIN',
  '특강 최초 신청 접수 (관리자)',
  'ADMIN',
  E'[STIZ] 새 특강 신청\n{{childName}} - {{parentName}}\n특강: {{seasonTitle}} / {{offeringTitle}}',
  true,
  '특강 최초 신청 시 관리자에게 한 번 알림',
  '["childName","seasonTitle","offeringTitle","parentName","parentPhone"]'
)
ON CONFLICT (trigger) DO NOTHING;

INSERT INTO public."MessageAutomationRule" (
  trigger, name, "audienceScope", target, "isActive",
  "requestedChannel", "fallbackEnabled", "fallbackChannel",
  "templateId", description
)
SELECT
  t.trigger, t.name, 'INTERNAL', t.target, true,
  'SMS', true, 'SMS', t.id, t.description
FROM public."SmsTemplate" t
WHERE t.trigger = 'SPECIAL_APPLICATION_NEW_ADMIN'
ON CONFLICT (trigger) DO UPDATE
SET
  "isActive" = true,
  "templateId" = COALESCE(public."MessageAutomationRule"."templateId", EXCLUDED."templateId"),
  "updatedAt" = NOW();

UPDATE public."SmsTemplate"
SET "isActive" = true, "updatedAt" = NOW()
WHERE trigger IN ('TRIAL_NEW_ADMIN', 'ENROLL_NEW_ADMIN', 'SPECIAL_APPLICATION_NEW_ADMIN');

UPDATE public."MessageAutomationRule"
SET "isActive" = true, "updatedAt" = NOW()
WHERE trigger IN ('TRIAL_NEW_ADMIN', 'ENROLL_NEW_ADMIN', 'SPECIAL_APPLICATION_NEW_ADMIN');

UPDATE public."SmsTemplate"
SET "isActive" = false, "updatedAt" = NOW()
WHERE trigger IN (
  'TRIAL_NEW_COACH',
  'TRIAL_CONFIRM_PARENT',
  'TRIAL_ATTENDED_PARENT',
  'ENROLL_NEW_COACH',
  'ENROLL_CONFIRM_PARENT',
  'SPECIAL_APPLICATION_RECEIVED_PARENT',
  'SPECIAL_APPLICATION_APPROVED_PARENT'
);

UPDATE public."MessageAutomationRule"
SET "isActive" = false, "updatedAt" = NOW()
WHERE trigger IN (
  'TRIAL_NEW_COACH',
  'TRIAL_CONFIRM_PARENT',
  'TRIAL_ATTENDED_PARENT',
  'ENROLL_NEW_COACH',
  'ENROLL_CONFIRM_PARENT',
  'SPECIAL_APPLICATION_RECEIVED_PARENT',
  'SPECIAL_APPLICATION_APPROVED_PARENT'
);

UPDATE public."SmsTemplate"
SET "isActive" = true, "updatedAt" = NOW()
WHERE trigger IN (
  'TRIAL_SCHEDULED_PARENT',
  'TRIAL_SCHEDULED_COACH',
  'ENROLL_APPROVED_PARENT',
  'ENROLL_APPROVED_COACH',
  'SPECIAL_APPLICATION_WAITLISTED_PARENT',
  'SPECIAL_APPLICATION_REJECTED_PARENT',
  'SPECIAL_APPLICATION_CANCELLED_PARENT',
  'SPECIAL_ACCOUNT_ACTIVATION_PARENT',
  'SPECIAL_PAYMENT_REQUEST_PARENT'
);

UPDATE public."MessageAutomationRule"
SET "isActive" = true, "updatedAt" = NOW()
WHERE trigger IN (
  'TRIAL_SCHEDULED_PARENT',
  'TRIAL_SCHEDULED_COACH',
  'ENROLL_APPROVED_PARENT',
  'ENROLL_APPROVED_COACH',
  'SPECIAL_APPLICATION_WAITLISTED_PARENT',
  'SPECIAL_APPLICATION_REJECTED_PARENT',
  'SPECIAL_APPLICATION_CANCELLED_PARENT',
  'SPECIAL_ACCOUNT_ACTIVATION_PARENT',
  'SPECIAL_PAYMENT_REQUEST_PARENT'
);
