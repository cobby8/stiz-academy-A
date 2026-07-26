-- 중복 학생 병합(soft merge) 기반 스키마
-- 왜: 같은 아이가 Student 2행으로 갈라진 8쌍을 합쳐야 하는데, 하드 DELETE는 되돌릴 수 없다.
--     그래서 흡수된 행은 지우지 않고 "이쪽으로 합쳐졌다"는 표시만 남기고,
--     모든 변경을 로그로 남겨 언제든 원상복구할 수 있게 한다.
-- 특징: 전부 추가(additive)만 한다. 기존 행/값은 하나도 바뀌지 않는다.
--       IF NOT EXISTS 라서 몇 번을 다시 실행해도 결과가 같다(멱등).
-- 적용: psql "$DIRECT_URL" -f prisma/sql/add_student_merge.sql
--       ※ prisma migrate dev 는 절대 쓰지 않는다(_prisma_migrations 드리프트 → DB 리셋 제안).

BEGIN;

-- 1) 흡수된 학생 행에 "어디로 합쳐졌는지"를 기록하는 컬럼
--    NULL = 정상 학생, 값 있음 = 흡수되어 더 이상 단독으로 취급하지 않는 학생
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "mergedIntoStudentId" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "mergedAt" TIMESTAMP(3);

-- 자기 자신을 가리키는 FK. 대표 학생이 실수로 지워지는 것을 막는다(RESTRICT).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Student_mergedIntoStudentId_fkey'
  ) THEN
    ALTER TABLE "Student"
      ADD CONSTRAINT "Student_mergedIntoStudentId_fkey"
      FOREIGN KEY ("mergedIntoStudentId") REFERENCES "Student"(id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

-- 자기 자신으로 병합되는 자기참조 사고 방지
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Student_merged_not_self_check'
  ) THEN
    ALTER TABLE "Student"
      ADD CONSTRAINT "Student_merged_not_self_check"
      CHECK ("mergedIntoStudentId" IS NULL OR "mergedIntoStudentId" <> id);
  END IF;
END $$;

-- 병합 학생만 빠르게 걸러내기 위한 부분 인덱스(정상 학생 조회 비용은 늘지 않는다)
CREATE INDEX IF NOT EXISTS "Student_mergedIntoStudentId_idx"
  ON "Student" ("mergedIntoStudentId")
  WHERE "mergedIntoStudentId" IS NOT NULL;

-- 2) 변경 이력 원장. 여기에 남은 것만으로 원상복구가 가능해야 한다.
--    action 의미:
--      MOVE      = 자식 행의 studentId를 흡수 → 대표로 옮김
--      UPDATE    = 값을 바꿈 (Enrollment 상태 승격, 전화 재연결, 생일 통일 등)
--      SOFT_SKIP = UNIQUE 충돌 때문에 옮기지 않고 흡수 쪽에 남기고 상태만 낮춤
--      MARK      = 흡수 학생에 mergedIntoStudentId 표시
CREATE TABLE IF NOT EXISTS "StudentMergeLog" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "mergeId" TEXT NOT NULL,                 -- 한 번의 병합 실행 묶음 ID (롤백 단위)
  "winnerStudentId" TEXT NOT NULL,         -- 대표(살아남는) 학생
  "loserStudentId" TEXT NOT NULL,          -- 흡수되는 학생
  "tableName" TEXT NOT NULL,
  "rowId" TEXT NOT NULL,
  "column" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  action TEXT NOT NULL CHECK (action IN ('MOVE', 'UPDATE', 'SOFT_SKIP', 'MARK')),
  note TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "StudentMergeLog_mergeId_idx" ON "StudentMergeLog" ("mergeId");
CREATE INDEX IF NOT EXISTS "StudentMergeLog_loser_idx" ON "StudentMergeLog" ("loserStudentId");
CREATE INDEX IF NOT EXISTS "StudentMergeLog_table_row_idx" ON "StudentMergeLog" ("tableName", "rowId");

COMMIT;
