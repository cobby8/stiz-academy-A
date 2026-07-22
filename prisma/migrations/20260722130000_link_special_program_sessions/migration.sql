-- 기존 운영 DB마다 Session 확장 컬럼 적용 시점이 달랐으므로,
-- 특강 회차를 연결하기 전에 이 마이그레이션이 직접 필요한 컬럼을 보장한다.
ALTER TABLE "Session"
  ADD COLUMN IF NOT EXISTS "sessionKey" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PLANNED',
  ADD COLUMN IF NOT EXISTS "coachId" TEXT;

WITH duplicate_session_keys AS (
  SELECT id, row_number() OVER (PARTITION BY "sessionKey" ORDER BY "createdAt", id) AS duplicate_rank
    FROM "Session" WHERE "sessionKey" IS NOT NULL
)
UPDATE "Session" session SET "sessionKey" = NULL
  FROM duplicate_session_keys duplicate
 WHERE session.id = duplicate.id AND duplicate.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionKey_key"
ON "Session"("sessionKey");

ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "specialProgramSessionDateId" TEXT;

UPDATE "Session" session SET "specialProgramSessionDateId" = NULL
 WHERE session."specialProgramSessionDateId" IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "SpecialProgramSessionDate" session_date
      WHERE session_date.id = session."specialProgramSessionDateId"
   );

WITH duplicate_session_dates AS (
  SELECT id, row_number() OVER (PARTITION BY "specialProgramSessionDateId" ORDER BY "createdAt", id) AS duplicate_rank
    FROM "Session" WHERE "specialProgramSessionDateId" IS NOT NULL
)
UPDATE "Session" session SET "specialProgramSessionDateId" = NULL
  FROM duplicate_session_dates duplicate
 WHERE session.id = duplicate.id AND duplicate.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Session_specialProgramSessionDateId_key"
ON "Session"("specialProgramSessionDateId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Session_specialProgramSessionDateId_fkey'
  ) THEN
    ALTER TABLE "Session"
    ADD CONSTRAINT "Session_specialProgramSessionDateId_fkey"
    FOREIGN KEY ("specialProgramSessionDateId") REFERENCES "SpecialProgramSessionDate"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "Session" (
  id, "classId", date, "sessionKey", status, "coachId",
  "specialProgramSessionDateId", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  offering."linkedClassId",
  (session_date."startsAt" AT TIME ZONE 'Asia/Seoul')::date,
  'seasonal:' || session_date.id,
  'PLANNED',
  offering."instructorId",
  session_date.id,
  NOW(),
  NOW()
FROM "SpecialProgramSessionDate" session_date
JOIN "SpecialProgramOffering" offering ON offering.id = session_date."offeringId"
JOIN "Class" linked_class ON linked_class.id = offering."linkedClassId"
WHERE offering."linkedClassId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Session" existing
    WHERE existing."specialProgramSessionDateId" = session_date.id
       OR existing."sessionKey" = 'seasonal:' || session_date.id
  );
