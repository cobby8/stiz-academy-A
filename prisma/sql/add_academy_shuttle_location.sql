-- 학원(셔틀 기준점) 위치를 AcademySettings에 저장하기 위한 컬럼 추가.
--
-- 왜 이렇게 하는가:
--   기존에는 SHUTTLE_ACADEMY_LATITUDE / _LONGITUDE / _NAME 환경변수만 정본이었다.
--   환경변수는 배포 환경마다 따로 넣어야 해서 한 곳만 빠져도 반별 자동배치가
--   409(ACADEMY_COORDINATES_REQUIRED)로 죽는다. 원장이 직접 고칠 방법도 없다.
--   그래서 DB(AcademySettings 싱글톤)를 정본으로 올리고 환경변수는 fallback으로 남긴다.
--
-- ⚠️ prisma migrate dev 금지(_prisma_migrations 드리프트 → DB 리셋 제안).
--    이 파일을 직접 적용한 뒤 `npx prisma generate`만 실행한다.
--
-- 안전성: 전부 ADD COLUMN IF NOT EXISTS(추가 전용, NULL 허용, 기본값 없음)라
--         기존 행과 기존 컬럼에 아무 영향이 없고, 몇 번 실행해도 결과가 같다.
--
-- 타입이 TEXT인 이유:
--   src/app/actions/admin.ts 의 rawUpsertAcademySettings 는 저장 중 없는 컬럼을 만나면
--   BOOLEAN 목록에 없는 한 자동으로 TEXT 로 만든다. 여기서 DOUBLE PRECISION 을 쓰면
--   그 fallback 경로와 타입이 어긋나 환경마다 컬럼 타입이 달라질 수 있다.
--   좌표는 읽는 쪽에서 Number()로 변환하고 유한값·한국 범위를 검증한다.
--   (검증 로직: src/lib/shuttle/academyLocation.ts)

ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "academyPlaceName" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "academyAddress" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "academyLatitude" TEXT;
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "academyLongitude" TEXT;
