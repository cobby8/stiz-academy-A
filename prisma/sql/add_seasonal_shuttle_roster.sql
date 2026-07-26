-- 방학특강 셔틀 "확정 명단"(SeasonalShuttleRoster) 테이블 추가.
--
-- 왜 이 테이블이 필요한가:
--   지금까지 "셔틀 태울 학생"은 어디에도 저장돼 있지 않았다. 화면마다 신청서·수강항목·
--   개설반·셔틀신청 4개 테이블을 새로 조인해 걸러야 했고, 새 SQL을 쓸 때마다 필터가
--   빠졌다(2026-07-26 기준 같은 사고 5회 반복). 공용 SQL 조각(shuttleEligibility.ts)만으로는
--   "새 쿼리가 그걸 안 쓰면" 또 뚫린다.
--   → 원장이 한 번 확인해 확정한 명단을 값으로 복제해 저장하고, 모든 화면이 이것만 본다.
--
-- 설계 결정(원장 승인, 2026-07-26):
--   1) 확정 단위 = 시즌 × 셔틀신청 1행. 등원/하원은 행 분리가 아니라 컬럼으로 둔다.
--   2) 날짜별 명단은 저장하지 않는다. 확정본 × SpecialProgramEnrollmentDate(SCHEDULED)로 파생한다.
--      (15운행일 × 2방향 = 30번 확정은 운영이 불가능하다.)
--   3) 자동 백필하지 않는다. 확정은 "사람이 확인했다"는 뜻이라 자동 생성하면 제도가 무의미해진다.
--   4) 하드 DELETE 금지. 제외는 removedAt / removedReason 으로 남긴다.
--
-- ⚠️ 원본 테이블에 FK를 걸지 않는다.
--   FK(ON DELETE CASCADE)를 걸면 원본 신청이 지워질 때 확정본도 함께 죽는다.
--   "원본이 흔들려도 확정본은 유지된다"가 이 테이블의 존재 이유이므로 ID만 문자열로 든다.
--   (같은 관례: SpecialProgramEnrollmentDate — applicationItemId/sessionDateId 모두 FK 없음)
--
-- ⚠️ prisma migrate dev 금지(_prisma_migrations 드리프트 → DB 리셋 제안).
--    이 파일을 직접 적용한 뒤 `npx prisma generate`만 실행한다.
--
-- 안전성: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
--         조합이라 몇 번 실행해도 결과가 같다. 기존 테이블 ALTER 0건, DROP 0건.

CREATE TABLE IF NOT EXISTS "SeasonalShuttleRoster" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,

  -- ── 원본 링크(FK 없음. 값 복제본이 정본이고, 이건 되짚어 보기용 ID다) ──
  "seasonId" TEXT NOT NULL,
  "shuttleRequestId" TEXT NOT NULL,
  "applicationItemId" TEXT,

  -- ── 사람 스냅샷 ──
  "studentIdSnapshot" TEXT,          -- 전환된 Student.id (학부모 마이페이지가 자녀와 잇는 열쇠)
  "studentNameSnapshot" TEXT NOT NULL,
  "childGradeSnapshot" TEXT,
  "childGenderSnapshot" TEXT,
  "childPhoneSnapshot" TEXT,
  "parentNameSnapshot" TEXT,
  "parentPhoneSnapshot" TEXT,

  -- ── 수업 스냅샷 ──
  "offeringIdSnapshot" TEXT,
  "offeringTitleSnapshot" TEXT,
  "weekdaysSnapshot" JSONB,          -- 예: ["MON","WED","FRI"]
  "classStartSnapshot" TEXT,         -- 'HH24:MI' (Asia/Seoul)
  "classEndSnapshot" TEXT,
  "requestCreatedAtSnapshot" TIMESTAMPTZ,  -- 미배정 목록의 기존 정렬(신청순)을 그대로 재현하기 위한 값

  -- ── 탑승 여부 ★ ──
  -- 지금은 셔틀신청의 status 컬럼을 REQUESTED/CANCELLED로 덮어써서 탑승을 토글하는데,
  -- 그 컬럼은 노선 배정(syncLegacyAssignment)이 ASSIGNED를 쓰는 같은 칸이다.
  -- 확정본에 전용 컬럼을 두면 그 충돌이 구조적으로 사라진다. (실제 이관은 3단계)
  "ride" BOOLEAN NOT NULL DEFAULT true,

  -- ── 등원(PICKUP) ──
  "pickupLocation" TEXT,
  "pickupAddress" TEXT,
  "pickupRoadAddress" TEXT,
  "pickupLatitude" DOUBLE PRECISION,
  "pickupLongitude" DOUBLE PRECISION,
  "pickupPlaceId" TEXT,
  "pickupLocationSource" TEXT,
  "pickupAccuracyMeters" DOUBLE PRECISION,
  -- ★ 관리자가 위치를 확인한 시각. 노선 편성 화면의 "이 학생 배차 가능" 판정에 쓰이므로 반드시 복제한다.
  "pickupConfirmedAt" TIMESTAMPTZ,
  "pickupTime" TEXT,                 -- 학부모 희망시간(참고값). 형식이 제각각이라 계산에 쓰지 않는다.

  -- ── 하원(DROPOFF) ──
  "dropoffLocation" TEXT,
  "dropoffAddress" TEXT,
  "dropoffRoadAddress" TEXT,
  "dropoffLatitude" DOUBLE PRECISION,
  "dropoffLongitude" DOUBLE PRECISION,
  "dropoffPlaceId" TEXT,
  "dropoffLocationSource" TEXT,
  "dropoffAccuracyMeters" DOUBLE PRECISION,
  "dropoffConfirmedAt" TIMESTAMPTZ,
  "dropoffSameAsPickup" BOOLEAN NOT NULL DEFAULT false,

  -- ── 확정/변동 관리 ──
  "sourceFingerprint" TEXT,          -- 확정 시점 원본 값들의 md5. 4단계 변동 감지가 이걸로 비교한다.
  "confirmedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "confirmedByUserId" TEXT,
  "removedAt" TIMESTAMPTZ,           -- soft delete. 하드 DELETE 금지.
  "removedReason" TEXT,
  "note" TEXT,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 이미 테이블이 있는 환경(부분 적용본)에서도 컬럼이 빠지지 않게 개별 보장한다.
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "applicationItemId" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "studentIdSnapshot" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "childGradeSnapshot" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "childGenderSnapshot" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "childPhoneSnapshot" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "parentNameSnapshot" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "parentPhoneSnapshot" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "offeringIdSnapshot" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "offeringTitleSnapshot" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "weekdaysSnapshot" JSONB;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "classStartSnapshot" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "classEndSnapshot" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "requestCreatedAtSnapshot" TIMESTAMPTZ;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "ride" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "pickupLocation" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "pickupAddress" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "pickupRoadAddress" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "pickupLatitude" DOUBLE PRECISION;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "pickupLongitude" DOUBLE PRECISION;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "pickupPlaceId" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "pickupLocationSource" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "pickupAccuracyMeters" DOUBLE PRECISION;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "pickupConfirmedAt" TIMESTAMPTZ;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "dropoffConfirmedAt" TIMESTAMPTZ;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "pickupTime" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "dropoffLocation" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "dropoffAddress" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "dropoffRoadAddress" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "dropoffLatitude" DOUBLE PRECISION;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "dropoffLongitude" DOUBLE PRECISION;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "dropoffPlaceId" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "dropoffLocationSource" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "dropoffAccuracyMeters" DOUBLE PRECISION;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "dropoffSameAsPickup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "sourceFingerprint" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "confirmedByUserId" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMPTZ;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "removedReason" TEXT;
ALTER TABLE "SeasonalShuttleRoster" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- 시즌 안에서 셔틀신청 1건은 확정본도 1행뿐이다(등원/하원은 컬럼이라 행이 늘지 않는다).
CREATE UNIQUE INDEX IF NOT EXISTS "SeasonalShuttleRoster_season_request_key"
  ON "SeasonalShuttleRoster" ("seasonId", "shuttleRequestId");

-- 통합 명단·기사님 CSV의 기본 조회 형태: 시즌 + 탑승여부 + 살아있는 행.
CREATE INDEX IF NOT EXISTS "SeasonalShuttleRoster_season_ride_removed_idx"
  ON "SeasonalShuttleRoster" ("seasonId", "ride", "removedAt");

-- 날짜별 운행 명단은 applicationItemId 로 SpecialProgramEnrollmentDate 와 이어 붙인다.
CREATE INDEX IF NOT EXISTS "SeasonalShuttleRoster_applicationItem_idx"
  ON "SeasonalShuttleRoster" ("applicationItemId");

-- ── 킬 스위치 ─────────────────────────────────────────────────────
-- 확정 명단 전환에 문제가 생겼을 때 원장이 재배포 없이 즉시 되돌릴 수 있어야 한다.
-- 그래서 환경변수가 아니라 DB(AcademySettings 싱글톤)에 둔다.
--
--   true        = 확정 명단을 쓴다(확정본이 있으면 그것만 본다)
--   false / NULL = 끔. 확정본을 무시하고 항상 원본 조회 = 전환 이전과 **완전히 동일한 동작**
--
-- 기본값을 "꺼짐"으로 둔 이유: 아무도 아무것도 안 해도 화면이 오늘과 1도 다르지 않아야 하기 때문이다.
-- 3단계에서 원장이 확정 버튼을 누르는 순간 이 값이 true로 켜진다.
--
-- 타입이 BOOLEAN인 이유: rawUpsertAcademySettings 의 컬럼 자동 생성 fallback 이
-- BOOLEAN_SETTINGS_COLUMNS 목록에 있는 이름만 BOOLEAN으로 만들고 나머지는 TEXT로 만든다.
-- 저장 화면 연동(그 목록 등록)은 3단계에서 처리한다 — 지금은 컬럼만 만들어 둔다.
ALTER TABLE "AcademySettings" ADD COLUMN IF NOT EXISTS "shuttleRosterConfirmedMode" BOOLEAN;
