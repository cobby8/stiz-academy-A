ALTER TABLE "EnrollmentApplication"
  ADD COLUMN IF NOT EXISTS "shuttlePickupAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "shuttlePickupRoadAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "shuttlePickupLatitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "shuttlePickupLongitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "shuttlePickupPlaceId" TEXT,
  ADD COLUMN IF NOT EXISTS "shuttlePickupSource" TEXT,
  ADD COLUMN IF NOT EXISTS "shuttlePickupAccuracyMeters" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "shuttlePickupConfirmedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "shuttleDropoffAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "shuttleDropoffRoadAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "shuttleDropoffLatitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "shuttleDropoffLongitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "shuttleDropoffPlaceId" TEXT,
  ADD COLUMN IF NOT EXISTS "shuttleDropoffSource" TEXT,
  ADD COLUMN IF NOT EXISTS "shuttleDropoffAccuracyMeters" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "shuttleDropoffConfirmedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "shuttleLocationConsentVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "shuttleLocationConsentAt" TIMESTAMPTZ;

ALTER TABLE "EnrollmentApplication"
  ADD CONSTRAINT "EnrollmentApplication_shuttle_pickup_coordinate_check"
    CHECK (
      ("shuttlePickupLatitude" IS NULL AND "shuttlePickupLongitude" IS NULL)
      OR (
        "shuttlePickupLatitude" IS NOT NULL
        AND "shuttlePickupLongitude" IS NOT NULL
        AND "shuttlePickupLatitude" BETWEEN -90 AND 90
        AND "shuttlePickupLongitude" BETWEEN -180 AND 180
      )
    ),
  ADD CONSTRAINT "EnrollmentApplication_shuttle_dropoff_coordinate_check"
    CHECK (
      ("shuttleDropoffLatitude" IS NULL AND "shuttleDropoffLongitude" IS NULL)
      OR (
        "shuttleDropoffLatitude" IS NOT NULL
        AND "shuttleDropoffLongitude" IS NOT NULL
        AND "shuttleDropoffLatitude" BETWEEN -90 AND 90
        AND "shuttleDropoffLongitude" BETWEEN -180 AND 180
      )
    ),
  ADD CONSTRAINT "EnrollmentApplication_shuttle_accuracy_check"
    CHECK (
      ("shuttlePickupAccuracyMeters" IS NULL OR "shuttlePickupAccuracyMeters" BETWEEN 0 AND 1000000)
      AND ("shuttleDropoffAccuracyMeters" IS NULL OR "shuttleDropoffAccuracyMeters" BETWEEN 0 AND 1000000)
    ),
  ADD CONSTRAINT "EnrollmentApplication_shuttle_pickup_location_check"
    CHECK (
      "shuttlePickupLatitude" IS NULL
      OR (
        LENGTH(TRIM(COALESCE("shuttlePickupAddress", ''))) > 0
        AND "shuttlePickupSource" IN ('MAP_PIN', 'SEARCH', 'CURRENT_LOCATION')
        AND "shuttlePickupConfirmedAt" IS NOT NULL
      )
    ),
  ADD CONSTRAINT "EnrollmentApplication_shuttle_dropoff_location_check"
    CHECK (
      "shuttleDropoffLatitude" IS NULL
      OR (
        LENGTH(TRIM(COALESCE("shuttleDropoffAddress", ''))) > 0
        AND "shuttleDropoffSource" IN ('MAP_PIN', 'SEARCH', 'CURRENT_LOCATION')
        AND "shuttleDropoffConfirmedAt" IS NOT NULL
      )
    ),
  ADD CONSTRAINT "EnrollmentApplication_shuttle_location_consent_check"
    CHECK (
      ("shuttleLocationConsentVersion" IS NULL AND "shuttleLocationConsentAt" IS NULL)
      OR (
        "shuttleLocationConsentVersion" IS NOT NULL
        AND LENGTH(TRIM("shuttleLocationConsentVersion")) > 0
        AND "shuttleLocationConsentAt" IS NOT NULL
      )
    ),
  ADD CONSTRAINT "EnrollmentApplication_shuttle_location_complete_check"
    CHECK (
      (
        COALESCE("shuttleNeeded", false) = false
        AND ROW(
          "shuttlePickupAddress", "shuttlePickupRoadAddress",
          "shuttlePickupLatitude", "shuttlePickupLongitude", "shuttlePickupPlaceId",
          "shuttlePickupSource", "shuttlePickupAccuracyMeters", "shuttlePickupConfirmedAt",
          "shuttleDropoffAddress", "shuttleDropoffRoadAddress",
          "shuttleDropoffLatitude", "shuttleDropoffLongitude", "shuttleDropoffPlaceId",
          "shuttleDropoffSource", "shuttleDropoffAccuracyMeters", "shuttleDropoffConfirmedAt",
          "shuttleLocationConsentVersion", "shuttleLocationConsentAt"
        ) IS NULL
      )
      OR (
        COALESCE("shuttleNeeded", false) = true
        AND (
          ROW(
            "shuttlePickupAddress", "shuttlePickupRoadAddress",
            "shuttlePickupLatitude", "shuttlePickupLongitude", "shuttlePickupPlaceId",
            "shuttlePickupSource", "shuttlePickupAccuracyMeters", "shuttlePickupConfirmedAt",
            "shuttleDropoffAddress", "shuttleDropoffRoadAddress",
            "shuttleDropoffLatitude", "shuttleDropoffLongitude", "shuttleDropoffPlaceId",
            "shuttleDropoffSource", "shuttleDropoffAccuracyMeters", "shuttleDropoffConfirmedAt",
            "shuttleLocationConsentVersion", "shuttleLocationConsentAt"
          ) IS NULL
          OR (
            LENGTH(TRIM(COALESCE("shuttlePickupAddress", ''))) > 0
            AND "shuttlePickupLatitude" IS NOT NULL
            AND "shuttlePickupLongitude" IS NOT NULL
            AND "shuttlePickupSource" IN ('MAP_PIN', 'SEARCH', 'CURRENT_LOCATION')
            AND "shuttlePickupConfirmedAt" IS NOT NULL
            AND LENGTH(TRIM(COALESCE("shuttleDropoffAddress", ''))) > 0
            AND "shuttleDropoffLatitude" IS NOT NULL
            AND "shuttleDropoffLongitude" IS NOT NULL
            AND "shuttleDropoffSource" IN ('MAP_PIN', 'SEARCH', 'CURRENT_LOCATION')
            AND "shuttleDropoffConfirmedAt" IS NOT NULL
            AND LENGTH(TRIM(COALESCE("shuttleLocationConsentVersion", ''))) > 0
            AND "shuttleLocationConsentAt" IS NOT NULL
          )
        )
      )
    );
