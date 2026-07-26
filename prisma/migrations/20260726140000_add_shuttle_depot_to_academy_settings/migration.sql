-- 셔틀 차고지(하루 운행 시작/종료 지점) — AcademySettings에 저장
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "shuttleDepotAddress" text;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "shuttleDepotLatitude" double precision;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "shuttleDepotLongitude" double precision;
