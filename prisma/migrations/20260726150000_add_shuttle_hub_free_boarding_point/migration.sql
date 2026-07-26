-- 무료 탑승 거점(1호점 등) — 최적 경로가 항상 경유하는 고정 지점
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "shuttleHubName" text;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "shuttleHubAddress" text;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "shuttleHubLatitude" double precision;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "shuttleHubLongitude" double precision;
