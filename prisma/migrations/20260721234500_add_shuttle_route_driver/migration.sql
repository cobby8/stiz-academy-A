ALTER TABLE "ShuttleRoutePlan"
  ADD COLUMN IF NOT EXISTS "driverUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ShuttleRoutePlan_driverUserId_fkey'
  ) THEN
    ALTER TABLE "ShuttleRoutePlan"
      ADD CONSTRAINT "ShuttleRoutePlan_driverUserId_fkey"
      FOREIGN KEY ("driverUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ShuttleRoutePlan_driverUserId_serviceDate_idx"
  ON "ShuttleRoutePlan"("driverUserId", "serviceDate");
