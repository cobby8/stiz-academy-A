-- ============================================================
-- Stiz Academy: 누락 컬럼 일괄 추가 스크립트
-- Supabase SQL Editor에서 한 번에 실행하세요.
-- IF NOT EXISTS 사용 → 이미 있는 컬럼은 건드리지 않음 (데이터 안전)
-- ============================================================

-- [Program] 신규 컬럼
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "weeklyFrequency" TEXT;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "order"            INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "days"             TEXT;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "priceWeek1"       INTEGER;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "priceWeek2"       INTEGER;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "priceWeek3"       INTEGER;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "priceDaily"       INTEGER;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "shuttleFeeOverride" INTEGER;

-- [Coach] 신규 컬럼
ALTER TABLE "Coach" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

-- [ClassSlotOverride] 코치/프로그램 FK 컬럼
ALTER TABLE "ClassSlotOverride" ADD COLUMN IF NOT EXISTS "coachId"   TEXT;
ALTER TABLE "ClassSlotOverride" ADD COLUMN IF NOT EXISTS "programId" TEXT;
ALTER TABLE "ClassSlotOverride" ADD COLUMN IF NOT EXISTS "startTimeOverride" TEXT;
ALTER TABLE "ClassSlotOverride" ADD COLUMN IF NOT EXISTS "endTimeOverride"   TEXT;

-- [CustomClassSlot] 코치/프로그램 FK 컬럼
ALTER TABLE "CustomClassSlot" ADD COLUMN IF NOT EXISTS "coachId"   TEXT;
ALTER TABLE "CustomClassSlot" ADD COLUMN IF NOT EXISTS "programId" TEXT;

-- [AcademySettings] 이용약관 + 체험/수강신청 콘텐츠 컬럼
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "termsOfService" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "trialTitle"    TEXT DEFAULT '체험수업 안내';
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "trialContent"  TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "trialFormUrl"  TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "enrollTitle"   TEXT DEFAULT '수강신청 안내';
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "enrollContent" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "enrollFormUrl" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "googleCalendarIcsUrl"     TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "googleSheetsScheduleUrl" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "classDays"     TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "siteBodyFont"  TEXT DEFAULT 'system';
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "siteHeadingFont" TEXT DEFAULT 'system';
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "pageDesignJSON" TEXT;
