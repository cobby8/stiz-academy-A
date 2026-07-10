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
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "operatingHours" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "privacyPolicy" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "footerDescription" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "footerCopyright" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "instagramBusinessAccountId" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "instagramAutoPublishEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "kakaoChannelUrl" TEXT;
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

-- [GalleryPost] Instagram import/publish metadata
ALTER TABLE "GalleryPost" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'WEBSITE';
ALTER TABLE "GalleryPost" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "GalleryPost" ADD COLUMN IF NOT EXISTS "externalUrl" TEXT;
ALTER TABLE "GalleryPost" ADD COLUMN IF NOT EXISTS "instagramMediaId" TEXT;
ALTER TABLE "GalleryPost" ADD COLUMN IF NOT EXISTS "instagramPermalink" TEXT;
ALTER TABLE "GalleryPost" ADD COLUMN IF NOT EXISTS "instagramPublishedAt" TIMESTAMPTZ;
ALTER TABLE "GalleryPost" ADD COLUMN IF NOT EXISTS "instagramPublishError" TEXT;

-- [Performance indexes] 관리자 목록/상세 조회 가속
CREATE INDEX IF NOT EXISTS "Student_parentId_idx" ON "Student" ("parentId");
CREATE INDEX IF NOT EXISTS "Student_name_parentId_idx" ON "Student" (name, "parentId");
CREATE INDEX IF NOT EXISTS "Class_programId_idx" ON "Class" ("programId");
CREATE INDEX IF NOT EXISTS "Class_instructorId_idx" ON "Class" ("instructorId");
CREATE INDEX IF NOT EXISTS "Enrollment_classId_status_idx" ON "Enrollment" ("classId", status);
CREATE INDEX IF NOT EXISTS "Session_classId_date_idx" ON "Session" ("classId", date);
CREATE INDEX IF NOT EXISTS "Session_published_date_idx" ON "Session" (published, date);
CREATE INDEX IF NOT EXISTS "Attendance_studentId_idx" ON "Attendance" ("studentId");
CREATE INDEX IF NOT EXISTS "Payment_studentId_year_month_idx" ON "Payment" ("studentId", year, month);
CREATE INDEX IF NOT EXISTS "Payment_studentId_dueDate_idx" ON "Payment" ("studentId", "dueDate");
CREATE INDEX IF NOT EXISTS "TrialLead_status_createdAt_idx" ON "TrialLead" (status, "createdAt");
CREATE INDEX IF NOT EXISTS "EnrollmentApplication_status_createdAt_idx" ON "EnrollmentApplication" (status, "createdAt");
