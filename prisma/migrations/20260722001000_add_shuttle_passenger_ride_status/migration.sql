ALTER TABLE "ShuttleRoutePassenger"
  ADD COLUMN IF NOT EXISTS "rideStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "rideStatusUpdatedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "rideStatusUpdatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "rideStatusNote" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ShuttleRoutePassenger_rideStatus_check'
  ) THEN
    ALTER TABLE "ShuttleRoutePassenger"
      ADD CONSTRAINT "ShuttleRoutePassenger_rideStatus_check"
      CHECK ("rideStatus" IN ('PENDING', 'BOARDED', 'DROPPED_OFF', 'NO_SHOW'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ShuttleRoutePassenger_routePlanId_rideStatus_idx"
  ON "ShuttleRoutePassenger"("routePlanId", "rideStatus");
