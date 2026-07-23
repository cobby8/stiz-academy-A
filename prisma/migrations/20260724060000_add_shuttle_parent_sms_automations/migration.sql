-- 셔틀 학부모 필수 안내 문자 2종을 메시지 센터에서 관리할 수 있게 등록한다.
INSERT INTO public."SmsTemplate" (
  trigger, name, target, body, "isActive", description, variables
)
VALUES
  (
    'SHUTTLE_ROUTE_CONFIRMED_PARENT',
    '셔틀 노선 배정 확정 (학부모)',
    'PARENT',
    E'[STIZ] {{학생명}} 셔틀 {{운행방향}} 안내\n{{운행일}} {{예정시간}} / {{정류장}}',
    true,
    '셔틀 노선 배정이 확정되거나 확정 정보가 변경되면 학부모에게 안내',
    '["학생명","운행방향","운행일","예정시간","정류장"]'
  ),
  (
    'SHUTTLE_NO_SHOW_PARENT',
    '셔틀 미탑승 안내 (학부모)',
    'PARENT',
    E'[STIZ] {{학생명}} 학생이 오늘 {{운행방향}} 셔틀에 미탑승 처리되었습니다. 확인 부탁드립니다.',
    true,
    '기사가 학생을 미탑승 처리하면 학부모에게 즉시 안내',
    '["학생명","운행방향"]'
  )
ON CONFLICT (trigger) DO UPDATE
SET
  name = EXCLUDED.name,
  target = EXCLUDED.target,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  "updatedAt" = NOW();

-- 외부 학부모 대상 SMS 규칙으로 연결한다.
INSERT INTO public."MessageAutomationRule" (
  trigger, name, "audienceScope", target, "isActive",
  "requestedChannel", "fallbackEnabled", "fallbackChannel",
  "templateId", description
)
SELECT
  t.trigger, t.name, 'EXTERNAL', 'PARENT', true,
  'SMS', true, 'SMS', t.id, t.description
FROM public."SmsTemplate" t
WHERE t.trigger IN (
  'SHUTTLE_ROUTE_CONFIRMED_PARENT',
  'SHUTTLE_NO_SHOW_PARENT'
)
ON CONFLICT (trigger) DO UPDATE
SET
  name = EXCLUDED.name,
  "audienceScope" = 'EXTERNAL',
  target = 'PARENT',
  "templateId" = EXCLUDED."templateId",
  description = EXCLUDED.description,
  "updatedAt" = NOW();
