ALTER TABLE "ShuttleRoutePlan"
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "completedByUserId" TEXT;

ALTER TABLE "ShuttleRoutePlan"
  DROP CONSTRAINT IF EXISTS "ShuttleRoutePlan_confirmation_check";

ALTER TABLE "ShuttleRoutePlan"
  ADD CONSTRAINT "ShuttleRoutePlan_confirmation_check"
  CHECK (
    (
      "status" IN ('CONFIRMED', 'COMPLETED')
      AND "confirmedAt" IS NOT NULL
      AND "confirmedByUserId" IS NOT NULL
    )
    OR "status" NOT IN ('CONFIRMED', 'COMPLETED')
  );

ALTER TABLE "ShuttleRoutePlan"
  DROP CONSTRAINT IF EXISTS "ShuttleRoutePlan_completion_check";

ALTER TABLE "ShuttleRoutePlan"
  ADD CONSTRAINT "ShuttleRoutePlan_completion_check"
  CHECK (
    (
      "status" = 'COMPLETED'
      AND "completedAt" IS NOT NULL
      AND "completedByUserId" IS NOT NULL
    )
    OR "status" <> 'COMPLETED'
  );
