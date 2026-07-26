-- 셔틀 신청: 하원=등원 동일 여부 플래그 (학생 단위 통합 관리)
ALTER TABLE "SpecialProgramShuttleRequest" ADD COLUMN IF NOT EXISTS "dropoffSameAsPickup" boolean NOT NULL DEFAULT false;

-- 기존 데이터: 좌표가 같거나 텍스트 주소가 같으면 '등원과 동일'로 표시
UPDATE "SpecialProgramShuttleRequest"
SET "dropoffSameAsPickup" = true
WHERE ("pickupLatitude" IS NOT NULL AND "pickupLatitude" = "dropoffLatitude" AND "pickupLongitude" = "dropoffLongitude")
   OR ("pickupLocation" IS NOT NULL AND btrim("pickupLocation") <> '' AND btrim("pickupLocation") = btrim("dropoffLocation"));
