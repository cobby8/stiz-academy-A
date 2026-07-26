-- 기사님 운행 화면용 테이블 2개.
--
-- ShuttleRunLink: 로그인 없는 기사님 전용 링크. 추측 불가한 랜덤 토큰 → (날짜×방향) 매핑.
--   토큰이 유효할 때만 그 날 노선·학생 명단이 노출된다(관리자 로그인 대신 토큰이 열쇠).
-- ShuttleBoarding: 그 날 학생별 탑승/미탑승 기록(날짜×방향×셔틀신청 1행).
--   미탑승은 "기록만"(MVP). 알림 등 후속은 별도.
--
-- 안전성: CREATE TABLE/INDEX IF NOT EXISTS. 추가만, DROP 0건. 원본에 FK 없음(값 스냅샷 관례).

CREATE TABLE IF NOT EXISTS "ShuttleRunLink" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "token" TEXT NOT NULL,
  "serviceDate" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShuttleRunLink_token_key" ON "ShuttleRunLink" ("token");
CREATE UNIQUE INDEX IF NOT EXISTS "ShuttleRunLink_date_direction_key" ON "ShuttleRunLink" ("serviceDate", "direction");

CREATE TABLE IF NOT EXISTS "ShuttleBoarding" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "serviceDate" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "shuttleRequestId" TEXT NOT NULL,
  "studentName" TEXT,
  "status" TEXT NOT NULL,            -- 'BOARDED' | 'NOSHOW'
  "checkedVia" TEXT,                 -- 'driver' | 'admin'
  "checkedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShuttleBoarding_date_direction_request_key"
  ON "ShuttleBoarding" ("serviceDate", "direction", "shuttleRequestId");
