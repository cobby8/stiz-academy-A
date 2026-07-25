-- 프로그램 소프트 삭제(수강 이력 보존) + 셔틀 운행 여부 플래그
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp without time zone;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "runsShuttle" boolean NOT NULL DEFAULT true;

-- 주말 전용/셔틀비 0 프로그램은 미운행으로 초기화
UPDATE "Program" SET "runsShuttle" = false WHERE "shuttleFeeOverride" = 0;
