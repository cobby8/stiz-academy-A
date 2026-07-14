-- G1 운영 보안 마이그레이션 전 읽기 전용 사전 점검입니다.
-- 결과가 한 행이라도 나오면 중복 원인을 확인한 뒤 마이그레이션을 중단해야 합니다.
SELECT provider, "eventId", COUNT(*) AS duplicate_count
  FROM "PaymentWebhookEvent"
 WHERE "eventId" IS NOT NULL
 GROUP BY provider, "eventId"
HAVING COUNT(*) > 1
 ORDER BY duplicate_count DESC, provider, "eventId";
