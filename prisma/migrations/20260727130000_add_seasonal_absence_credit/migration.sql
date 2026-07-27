-- 방학특강 "사전 결석 신고 + 보강/이월/환불 + 이월 크레딧" 데이터 모델 추가.
--
-- 왜 필요한가: 학부모/관리자가 방학특강 결석을 미리 신고하고(SpecialProgramAbsence),
--   그 결석을 보강(MAKEUP)/이월(CARRYOVER)/환불(REFUND)로 처리한다. 이월로 처리하면
--   금액이 이월 크레딧 원장(SpecialProgramCredit)에 쌓인다.
--
-- 설계:
--   1) SpecialProgramAbsence: 좌석(SpecialProgramEnrollmentDate) 당 신고 1건 → enrollmentDateId UNIQUE.
--      enum 대신 기존 컨벤션(TEXT + 앱검증)을 따른다. DB CHECK 제약은 걸지 않는다(기존 status 컬럼들과 동일).
--        reason:     ILLNESS_INJURY | PERSONAL | FAMILY_TRIP | SCHOOL_EVENT | ETC
--        resolution: PENDING(기본) | MAKEUP | CARRYOVER | REFUND
--        status:     REPORTED(기본) | CONFIRMED | CANCELLED
--   2) SpecialProgramCredit: 이월 크레딧 원장. 어느 수강 항목(applicationItemId)에 얼마(amount, 원)가
--      어느 결석(sourceAbsenceId)에서 파생됐는지 추적. status ACTIVE(기본)|USED|REFUNDED.
--      sourceAbsenceId UNIQUE = 결석 1건당 크레딧 1건.
--   3) FK: enrollmentDate/applicationItem 은 원본 삭제 시 함께 삭제(CASCADE, 기존 shuttleRequest 관례와 동일).
--          sourceAbsence 는 옵셔널이라 결석이 지워지면 NULL 로(SET NULL).
--
-- 안전성(★ADD-ONLY): CREATE TABLE/INDEX IF NOT EXISTS 만 사용. 기존 테이블 ALTER 0건, DROP 0건, 컬럼변경 0건.
--   몇 번 실행해도 결과 동일(멱등). FK 는 신규 테이블에서 기존 테이블을 참조만 한다(기존 테이블 무변경).

-- 1) 사전 결석 신고
CREATE TABLE IF NOT EXISTS "SpecialProgramAbsence" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "enrollmentDateId" TEXT NOT NULL,                 -- SpecialProgramEnrollmentDate.id (좌석)
  "reason" TEXT NOT NULL,                            -- ILLNESS_INJURY | PERSONAL | FAMILY_TRIP | SCHOOL_EVENT | ETC
  "resolution" TEXT NOT NULL DEFAULT 'PENDING',      -- PENDING | MAKEUP | CARRYOVER | REFUND
  "status" TEXT NOT NULL DEFAULT 'REPORTED',         -- REPORTED | CONFIRMED | CANCELLED
  "note" TEXT,
  "reportedByUserId" TEXT,                            -- 신고한 학부모 앱 계정
  "resolvedByUserId" TEXT,                            -- 처리한 관리자
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SpecialProgramAbsence_enrollmentDateId_fkey"
    FOREIGN KEY ("enrollmentDateId") REFERENCES "SpecialProgramEnrollmentDate" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- 좌석당 신고 1건
CREATE UNIQUE INDEX IF NOT EXISTS "SpecialProgramAbsence_enrollmentDateId_key"
  ON "SpecialProgramAbsence" ("enrollmentDateId");

CREATE INDEX IF NOT EXISTS "SpecialProgramAbsence_status_idx"
  ON "SpecialProgramAbsence" ("status");

-- 2) 이월 크레딧 원장
CREATE TABLE IF NOT EXISTS "SpecialProgramCredit" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "applicationItemId" TEXT NOT NULL,                 -- SpecialProgramApplicationItem.id (귀속 항목)
  "amount" INTEGER NOT NULL,                          -- 금액(원, KRW)
  "sourceAbsenceId" TEXT,                             -- 파생된 결석(있으면). 결석 1건당 크레딧 1건
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',            -- ACTIVE | USED | REFUNDED
  "note" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SpecialProgramCredit_applicationItemId_fkey"
    FOREIGN KEY ("applicationItemId") REFERENCES "SpecialProgramApplicationItem" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpecialProgramCredit_sourceAbsenceId_fkey"
    FOREIGN KEY ("sourceAbsenceId") REFERENCES "SpecialProgramAbsence" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- 결석 1건당 크레딧 1건
CREATE UNIQUE INDEX IF NOT EXISTS "SpecialProgramCredit_sourceAbsenceId_key"
  ON "SpecialProgramCredit" ("sourceAbsenceId");

CREATE INDEX IF NOT EXISTS "SpecialProgramCredit_applicationItem_idx"
  ON "SpecialProgramCredit" ("applicationItemId");

CREATE INDEX IF NOT EXISTS "SpecialProgramCredit_status_idx"
  ON "SpecialProgramCredit" ("status");
