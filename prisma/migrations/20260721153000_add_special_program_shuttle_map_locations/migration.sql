ALTER TABLE "SpecialProgramShuttleRequest"
  ADD COLUMN "pickupAddress" TEXT,
  ADD COLUMN "pickupRoadAddress" TEXT,
  ADD COLUMN "pickupLatitude" DOUBLE PRECISION,
  ADD COLUMN "pickupLongitude" DOUBLE PRECISION,
  ADD COLUMN "pickupPlaceId" TEXT,
  ADD COLUMN "pickupLocationSource" TEXT,
  ADD COLUMN "pickupAccuracyMeters" DOUBLE PRECISION,
  ADD COLUMN "pickupConfirmedAt" TIMESTAMPTZ(6),
  ADD COLUMN "dropoffAddress" TEXT,
  ADD COLUMN "dropoffRoadAddress" TEXT,
  ADD COLUMN "dropoffLatitude" DOUBLE PRECISION,
  ADD COLUMN "dropoffLongitude" DOUBLE PRECISION,
  ADD COLUMN "dropoffPlaceId" TEXT,
  ADD COLUMN "dropoffLocationSource" TEXT,
  ADD COLUMN "dropoffAccuracyMeters" DOUBLE PRECISION,
  ADD COLUMN "dropoffConfirmedAt" TIMESTAMPTZ(6),
  ADD COLUMN "locationConsentVersion" TEXT;

ALTER TABLE "SpecialProgramShuttleRequest"
  ADD CONSTRAINT "SpecialProgramShuttleRequest_pickup_coordinate_pair_check"
    CHECK (("pickupLatitude" IS NULL) = ("pickupLongitude" IS NULL)),
  ADD CONSTRAINT "SpecialProgramShuttleRequest_pickup_latitude_range_check"
    CHECK ("pickupLatitude" IS NULL OR "pickupLatitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "SpecialProgramShuttleRequest_pickup_longitude_range_check"
    CHECK ("pickupLongitude" IS NULL OR "pickupLongitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "SpecialProgramShuttleRequest_dropoff_coordinate_pair_check"
    CHECK (("dropoffLatitude" IS NULL) = ("dropoffLongitude" IS NULL)),
  ADD CONSTRAINT "SpecialProgramShuttleRequest_dropoff_latitude_range_check"
    CHECK ("dropoffLatitude" IS NULL OR "dropoffLatitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "SpecialProgramShuttleRequest_dropoff_longitude_range_check"
    CHECK ("dropoffLongitude" IS NULL OR "dropoffLongitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "SpecialProgramShuttleRequest_pickup_accuracy_check"
    CHECK ("pickupAccuracyMeters" IS NULL OR "pickupAccuracyMeters" >= 0),
  ADD CONSTRAINT "SpecialProgramShuttleRequest_dropoff_accuracy_check"
    CHECK ("dropoffAccuracyMeters" IS NULL OR "dropoffAccuracyMeters" >= 0),
  ADD CONSTRAINT "SpecialProgramShuttleRequest_pickup_map_metadata_check"
    CHECK (
      "pickupLatitude" IS NULL OR (
        "pickupAddress" IS NOT NULL
        AND "pickupLocationSource" IN ('MAP_PIN', 'SEARCH', 'CURRENT_LOCATION')
        AND "pickupConfirmedAt" IS NOT NULL
        AND "locationConsentVersion" IS NOT NULL
      )
    ),
  ADD CONSTRAINT "SpecialProgramShuttleRequest_dropoff_map_metadata_check"
    CHECK (
      "dropoffLatitude" IS NULL OR (
        "dropoffAddress" IS NOT NULL
        AND "dropoffLocationSource" IN ('MAP_PIN', 'SEARCH', 'CURRENT_LOCATION')
        AND "dropoffConfirmedAt" IS NOT NULL
        AND "locationConsentVersion" IS NOT NULL
      )
    );
