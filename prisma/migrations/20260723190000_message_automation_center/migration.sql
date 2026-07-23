-- 관리자 메시지 센터: 자동 발송 규칙과 채널 설정
-- SmsTemplate은 과거 런타임 DDL로 생성된 환경이 있어 새 DB에도 먼저 보장한다.
CREATE TABLE IF NOT EXISTS public."SmsTemplate" (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trigger text NOT NULL UNIQUE,
  name text NOT NULL,
  target text NOT NULL,
  body text NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  description text,
  variables text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."MessageAutomationRule" (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trigger text NOT NULL,
  name text NOT NULL,
  "audienceScope" text NOT NULL
    CHECK ("audienceScope" IN ('INTERNAL', 'EXTERNAL', 'SECURITY')),
  target text NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "requestedChannel" text NOT NULL DEFAULT 'SMS',
  "fallbackEnabled" boolean NOT NULL DEFAULT true,
  "fallbackChannel" text DEFAULT 'SMS',
  "templateId" text REFERENCES public."SmsTemplate"(id) ON DELETE SET NULL,
  description text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "MessageAutomationRule_trigger_key" UNIQUE (trigger)
);

CREATE TABLE IF NOT EXISTS public."MessageChannelSetting" (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "audienceScope" text NOT NULL
    CHECK ("audienceScope" IN ('INTERNAL', 'EXTERNAL', 'SECURITY')),
  channel text NOT NULL,
  provider text NOT NULL DEFAULT 'SOLAPI',
  "isEnabled" boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
  "fallbackChannel" text,
  "senderProfileId" text,
  "configJSON" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "MessageChannelSetting_audienceScope_channel_key"
    UNIQUE ("audienceScope", channel)
);

CREATE INDEX IF NOT EXISTS "MessageAutomationRule_audienceScope_isActive_idx"
  ON public."MessageAutomationRule" ("audienceScope", "isActive");
CREATE INDEX IF NOT EXISTS "MessageAutomationRule_target_isActive_idx"
  ON public."MessageAutomationRule" (target, "isActive");
CREATE INDEX IF NOT EXISTS "MessageAutomationRule_templateId_idx"
  ON public."MessageAutomationRule" ("templateId");
CREATE INDEX IF NOT EXISTS "MessageChannelSetting_audienceScope_isEnabled_priority_idx"
  ON public."MessageChannelSetting" ("audienceScope", "isEnabled", priority);

-- 기존 SMS 템플릿을 같은 trigger의 자동 발송 규칙으로 안전하게 이관한다.
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
  trigger,
  name,
  CASE
    WHEN target IN ('ADMIN', 'COACH', 'STAFF') THEN 'INTERNAL'
    ELSE 'EXTERNAL'
  END,
  target,
  "isActive",
  'SMS',
  true,
  'SMS',
  id,
  description
FROM public."SmsTemplate"
ON CONFLICT (trigger) DO NOTHING;

-- 인증번호는 관리자가 실수로 끌 수 없는 잠금 규칙으로 별도 표시한다.
INSERT INTO public."MessageAutomationRule" (
  trigger,
  name,
  "audienceScope",
  target,
  "isActive",
  "requestedChannel",
  "fallbackEnabled",
  "fallbackChannel",
  description
)
VALUES (
  'SECURITY_PHONE_OTP',
  '휴대폰 본인인증',
  'SECURITY',
  'USER',
  true,
  'SMS',
  false,
  NULL,
  '회원가입·계정 활성화·직원 인증번호는 계정 보호를 위해 항상 SMS로 발송합니다.'
)
ON CONFLICT (trigger) DO NOTHING;

-- 연결 전인 알림톡/RCS는 꺼진 상태로 준비하고, 기존 SMS 동작은 유지한다.
INSERT INTO public."MessageChannelSetting" (
  "audienceScope", channel, provider, "isEnabled", priority, "fallbackChannel"
)
VALUES
  ('INTERNAL', 'PUSH', 'INTERNAL', true, 10, 'SMS'),
  ('INTERNAL', 'SMS', 'SOLAPI', true, 20, NULL),
  ('EXTERNAL', 'KAKAO_ALIMTALK', 'SOLAPI', false, 10, 'SMS'),
  ('EXTERNAL', 'RCS', 'SOLAPI', false, 20, 'SMS'),
  ('EXTERNAL', 'SMS', 'SOLAPI', true, 30, NULL),
  ('SECURITY', 'SMS', 'SOLAPI', true, 10, NULL)
ON CONFLICT ("audienceScope", channel) DO NOTHING;

-- 기존 이력은 원래 eventType/channel을 기준으로 읽을 수 있게 보강한다.
ALTER TABLE public."NotificationDelivery"
  ADD COLUMN IF NOT EXISTS trigger text,
  ADD COLUMN IF NOT EXISTS "audienceScope" text,
  ADD COLUMN IF NOT EXISTS "requestedChannel" text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS "messageType" text,
  ADD COLUMN IF NOT EXISTS "providerMessageId" text,
  ADD COLUMN IF NOT EXISTS "providerGroupId" text,
  ADD COLUMN IF NOT EXISTS "providerStatus" text,
  ADD COLUMN IF NOT EXISTS "fallbackUsed" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "fallbackChannel" text,
  ADD COLUMN IF NOT EXISTS "unitCost" numeric(10, 4),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KRW';

UPDATE public."NotificationDelivery"
SET
  trigger = COALESCE(trigger, "eventType"),
  "requestedChannel" = COALESCE("requestedChannel", channel),
  "messageType" = COALESCE("messageType", channel),
  provider = COALESCE(
    provider,
    CASE WHEN channel IN ('SMS', 'LMS', 'MMS') THEN 'SOLAPI' ELSE 'INTERNAL' END
  ),
  "audienceScope" = COALESCE(
    "audienceScope",
    CASE
      WHEN channel IN ('IN_APP', 'PUSH') THEN 'INTERNAL'
      ELSE 'EXTERNAL'
    END
  )
WHERE
  trigger IS NULL
  OR "requestedChannel" IS NULL
  OR "messageType" IS NULL
  OR provider IS NULL
  OR "audienceScope" IS NULL;

CREATE INDEX IF NOT EXISTS "NotificationDelivery_trigger_audienceScope_status_createdAt_idx"
  ON public."NotificationDelivery" (trigger, "audienceScope", status, "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_requestedChannel_createdAt_idx"
  ON public."NotificationDelivery" ("requestedChannel", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_provider_providerMessageId_idx"
  ON public."NotificationDelivery" (provider, "providerMessageId");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_provider_providerGroupId_idx"
  ON public."NotificationDelivery" (provider, "providerGroupId");
