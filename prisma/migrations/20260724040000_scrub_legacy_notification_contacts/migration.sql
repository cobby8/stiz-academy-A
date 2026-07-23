-- 기존 장부의 원문 전화번호는 끝 4자리만 남기고 제거합니다.
UPDATE public."NotificationDelivery"
SET
  "recipientPhoneLast4" = COALESCE(
    "recipientPhoneLast4",
    NULLIF(RIGHT(regexp_replace(COALESCE("recipientPhone", ''), '[^0-9]', '', 'g'), 4), '')
  ),
  "recipientPhone" = NULL,
  "payloadJSON" = CASE
    WHEN "payloadJSON" IS NULL THEN NULL
    ELSE "payloadJSON" - 'recipientPhone' - 'phone' - 'phoneNumber'
  END
WHERE
  "recipientPhone" IS NOT NULL
  OR (
    "payloadJSON" IS NOT NULL
    AND (
      "payloadJSON" ? 'recipientPhone'
      OR "payloadJSON" ? 'phone'
      OR "payloadJSON" ? 'phoneNumber'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS "MessageDeliveryBatch_manual_stableEventKey_key"
  ON public."MessageDeliveryBatch"("stableEventKey")
  WHERE source = 'MANUAL' AND "stableEventKey" IS NOT NULL;
