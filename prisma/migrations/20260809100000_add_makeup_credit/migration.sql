-- 보강권(MakeupCredit) — 결석 1회당 1장. 2026-08-09 개정 약관 반영.
--
-- MakeupSession(예약 기록)과 별도인 이유:
--   약관은 "결석하면 권리가 생기고 2개월 뒤 소멸한다"는 권리를 규정한다.
--   예약 전에도 존재하고 예약 없이 소멸하므로 예약 기록만으로는 표현할 수 없다.
CREATE TABLE IF NOT EXISTS "MakeupCredit" (
  "id"              TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "studentId"       TEXT NOT NULL,
  "sourceType"      TEXT NOT NULL,                 -- REGULAR | SEASONAL
  "sourceKey"       TEXT NOT NULL,                 -- 중복 발급 방지 자연키
  "absenceDate"     TIMESTAMPTZ(6) NOT NULL,       -- 만료 기준(발급일 아님)
  "expiresAt"       TIMESTAMPTZ(6) NOT NULL,       -- absenceDate + 2개월
  "originClassId"   TEXT,
  "originItemId"    TEXT,
  "originSessionId" TEXT,
  "status"          TEXT NOT NULL DEFAULT 'AVAILABLE',
  "makeupSessionId" TEXT,
  "note"            TEXT,
  "createdAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- 한 결석에 보강권은 한 장뿐. 출결을 껐다 켜도 중복 발급되지 않는다.
CREATE UNIQUE INDEX IF NOT EXISTS "MakeupCredit_student_source_key"
  ON "MakeupCredit" ("studentId", "sourceKey");
CREATE INDEX IF NOT EXISTS "MakeupCredit_student_status_idx"
  ON "MakeupCredit" ("studentId", "status");
-- 만료 처리 크론 전용
CREATE INDEX IF NOT EXISTS "MakeupCredit_status_expiresAt_idx"
  ON "MakeupCredit" ("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "MakeupCredit_makeupSessionId_idx"
  ON "MakeupCredit" ("makeupSessionId");

-- 상태값을 코드와 DB 양쪽에서 강제한다. 오타로 유령 상태가 생기면 잔여 장수 계산이 틀어진다.
ALTER TABLE "MakeupCredit" DROP CONSTRAINT IF EXISTS "MakeupCredit_status_check";
ALTER TABLE "MakeupCredit" ADD CONSTRAINT "MakeupCredit_status_check"
  CHECK ("status" = ANY (ARRAY['AVAILABLE','RESERVED','USED','NO_SHOW','EXPIRED','REVOKED']));
ALTER TABLE "MakeupCredit" DROP CONSTRAINT IF EXISTS "MakeupCredit_sourceType_check";
ALTER TABLE "MakeupCredit" ADD CONSTRAINT "MakeupCredit_sourceType_check"
  CHECK ("sourceType" = ANY (ARRAY['REGULAR','SEASONAL']));
