-- 무료 탑승 거점의 "하차 지점"을 탑승 지점과 별개로 저장한다.
--
-- 왜 필요한가: 무료 거점은 등원 탑승 위치(1호점)와 하원 하차 위치(길 건너 버스정류장)가
--   서로 다른 지점이다. 기존 shuttleHub* 컬럼은 탑승 지점 하나뿐이라, 하차 지점을 담을 곳이 없다.
--
-- 안전성(★ADD-ONLY): ADD COLUMN IF NOT EXISTS 만 사용. 기존 컬럼 변경/삭제 0건. 멱등(여러 번 실행해도 동일).

ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "shuttleHubDropoffName" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "shuttleHubDropoffAddress" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "shuttleHubDropoffLatitude" DOUBLE PRECISION;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "shuttleHubDropoffLongitude" DOUBLE PRECISION;
