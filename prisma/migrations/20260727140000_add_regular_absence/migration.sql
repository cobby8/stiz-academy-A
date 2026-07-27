-- 정규 수업 "사전 결석 신고" MVP — 신규 테이블 RegularAbsence 추가.
--
-- 왜 필요한가: 정규반은 방학특강처럼 미래 회차 좌석(SpecialProgramEnrollmentDate)이 없어서
--   "이 좌석 결석"으로 신고를 걸 대상이 없다. 그래서 결석 신고 자체를
--   (학생 × 반 × 날짜) 한 레코드로 둔다.
--
-- 설계:
--   1) reason/status 는 enum 대신 기존 컨벤션(TEXT + 앱검증). DB CHECK 제약 없음(기존 status 컬럼들과 동일).
--        reason: ILLNESS_INJURY | PERSONAL | FAMILY_TRIP | SCHOOL_EVENT | ETC (방학특강과 동일 코드값)
--        status: REPORTED(기본) | CONFIRMED | CANCELLED
--   2) date 는 DATE(날짜 단위) — 유니크 키에 쓰이므로 시간 성분이 섞이면 안 된다.
--   3) 유니크 (studentId, classId, date): 학생·반·날짜당 신고 1건.
--   4) FK: student/class 원본 삭제 시 함께 삭제(CASCADE). 신규 테이블이 기존 테이블을 참조만 한다(기존 무변경).
--
-- 안전성(★ADD-ONLY): CREATE TABLE/INDEX IF NOT EXISTS 만 사용. 기존 테이블 ALTER 0건, DROP 0건, 컬럼변경 0건.
--   몇 번 실행해도 결과 동일(멱등).

CREATE TABLE IF NOT EXISTS "RegularAbsence" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "studentId" TEXT NOT NULL,                          -- Student.id (결석 학생)
  "classId" TEXT NOT NULL,                            -- Class.id (정규 반)
  "date" DATE NOT NULL,                               -- 결석 날짜(날짜 단위)
  "reason" TEXT NOT NULL,                             -- ILLNESS_INJURY | PERSONAL | FAMILY_TRIP | SCHOOL_EVENT | ETC
  "status" TEXT NOT NULL DEFAULT 'REPORTED',          -- REPORTED | CONFIRMED | CANCELLED
  "note" TEXT,
  "reportedByUserId" TEXT,                             -- 신고한 학부모 앱 계정
  "resolvedByUserId" TEXT,                             -- 처리한 관리자
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "RegularAbsence_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RegularAbsence_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "Class" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- 학생·반·날짜당 신고 1건
CREATE UNIQUE INDEX IF NOT EXISTS "RegularAbsence_studentId_classId_date_key"
  ON "RegularAbsence" ("studentId", "classId", "date");

-- 기사/관리자 날짜별 조회
CREATE INDEX IF NOT EXISTS "RegularAbsence_classId_date_idx"
  ON "RegularAbsence" ("classId", "date");

CREATE INDEX IF NOT EXISTS "RegularAbsence_status_idx"
  ON "RegularAbsence" ("status");
