-- 선생님용 수업 시작·진행·종료 상태를 Session에 추가합니다.
-- 운영 DB 적용 전 백업과 중복 Session 검토가 필요합니다.

DO $$
BEGIN
  -- 처음 컬럼을 추가하는 순간에만 기존 수업을 완료 상태로 표시합니다.
  -- 이 조건이 있어야 SQL을 다시 실행해도 새 PLANNED 수업이 바뀌지 않습니다.
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Session'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE "Session"
      ADD COLUMN status TEXT NOT NULL DEFAULT 'PLANNED';

    UPDATE "Session"
    SET status = 'COMPLETED';
  END IF;
END
$$;

ALTER TABLE "Session"
  ADD COLUMN IF NOT EXISTS "sessionKey" TEXT,
  ADD COLUMN IF NOT EXISTS "plannedContent" TEXT,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "startedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "endedByUserId" TEXT;

-- 기존 기록 중 반·날짜가 같은 첫 기록은 표준 키를 사용합니다.
-- 같은 날 중복된 나머지 기록은 삭제하지 않고 legacy 키로 보존합니다.
WITH ranked_sessions AS (
  SELECT
    id,
    "classId",
    date,
    ROW_NUMBER() OVER (
      PARTITION BY "classId", (date AT TIME ZONE 'Asia/Seoul')::date
      ORDER BY "createdAt", id
    ) AS duplicate_order
  FROM "Session"
  WHERE "sessionKey" IS NULL
)
UPDATE "Session" AS session
SET "sessionKey" =
  ranked."classId"
  || ':'
  || TO_CHAR(ranked.date AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
  || CASE
       WHEN ranked.duplicate_order = 1 THEN ''
       ELSE ':legacy:' || ranked.id
     END
FROM ranked_sessions AS ranked
WHERE session.id = ranked.id
  AND session."sessionKey" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionKey_key"
  ON "Session" ("sessionKey");

CREATE INDEX IF NOT EXISTS "Session_status_date_idx"
  ON "Session" (status, date);

CREATE INDEX IF NOT EXISTS "Session_startedAt_idx"
  ON "Session" ("startedAt");

-- 잘못된 상태 문자열과 종료 시각 역전을 DB에서도 막습니다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Session_status_check'
  ) THEN
    ALTER TABLE "Session"
      ADD CONSTRAINT "Session_status_check"
      CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Session_time_order_check'
  ) THEN
    ALTER TABLE "Session"
      ADD CONSTRAINT "Session_time_order_check"
      CHECK ("endedAt" IS NULL OR "startedAt" IS NULL OR "endedAt" >= "startedAt");
  END IF;
END
$$;
