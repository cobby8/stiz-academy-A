-- 방학특강 수강일에 출결 필드 추가 (학생 전환과 무관하게 특강 출석 기록). 추가만, 멱등.
ALTER TABLE "SpecialProgramEnrollmentDate" ADD COLUMN IF NOT EXISTS "attendanceStatus" TEXT;
ALTER TABLE "SpecialProgramEnrollmentDate" ADD COLUMN IF NOT EXISTS "arrivedAt" TIMESTAMPTZ(6);
ALTER TABLE "SpecialProgramEnrollmentDate" ADD COLUMN IF NOT EXISTS "attendanceNote" TEXT;
ALTER TABLE "SpecialProgramEnrollmentDate" ADD COLUMN IF NOT EXISTS "attendanceCheckedAt" TIMESTAMPTZ(6);
ALTER TABLE "SpecialProgramEnrollmentDate" ADD COLUMN IF NOT EXISTS "attendanceCheckedByUserId" TEXT;
