-- NotificationDelivery.channel 허용값 확대.
--
-- 왜: 제약이 IN_APP/PUSH/SMS 뿐이라 **LMS·ALIMTALK·RCS 는 기록 자체가 불가능**했다.
--     2026-08-03 장문(LMS) 안내 문자에서 실제로 터졌고, 호출부가 그 예외를 '발송 실패'로
--     표시해 원장이 재발송 → 학부모 13명이 같은 문자를 두 번 받았다.
--     알림톡(ALIMTALK)을 쓰기 시작하면 같은 사고가 그대로 재현된다.
--
-- 허용값은 코드의 정본을 따른다:
--   · DeliveredMessageChannel = SMS | LMS | ALIMTALK | RCS  (message-channel-policy.ts)
--   · 알림 계열 IN_APP | PUSH
--   · KAKAO_ALIMTALK — 저장돼 있는 구 표기. 조회 코드(sms/history)가 이 값을 그대로 기대한다.
ALTER TABLE "NotificationDelivery" DROP CONSTRAINT IF EXISTS "NotificationDelivery_channel_check";
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_channel_check"
  CHECK (channel = ANY (ARRAY[
    'IN_APP'::text, 'PUSH'::text,
    'SMS'::text, 'LMS'::text,
    'ALIMTALK'::text, 'KAKAO_ALIMTALK'::text, 'RCS'::text
  ]));
