ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "specialProgramSessionDateId" TEXT;

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
