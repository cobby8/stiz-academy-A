CREATE TYPE "ShuttleRouteDirection" AS ENUM ('PICKUP', 'DROPOFF');
CREATE TYPE "ShuttleRoutePlanStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'ARCHIVED');

CREATE TABLE "ShuttleVehicle" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "name" TEXT NOT NULL,
  "plateNumber" TEXT,
  "capacity" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShuttleVehicle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShuttleVehicle_capacity_check" CHECK ("capacity" > 0)
);

CREATE TABLE "ShuttleRoutePlan" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "seasonId" TEXT NOT NULL,
  "vehicleId" TEXT,
  "routeKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "direction" "ShuttleRouteDirection" NOT NULL,
  "status" "ShuttleRoutePlanStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "serviceDate" DATE,
  "originName" TEXT,
  "originAddress" TEXT,
  "originLatitude" DOUBLE PRECISION,
  "originLongitude" DOUBLE PRECISION,
  "destinationName" TEXT,
  "destinationAddress" TEXT,
  "destinationLatitude" DOUBLE PRECISION,
  "destinationLongitude" DOUBLE PRECISION,
  "previousVersionId" TEXT,
  "confirmedAt" TIMESTAMPTZ(6),
  "confirmedByUserId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShuttleRoutePlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShuttleRoutePlan_version_check" CHECK ("version" > 0),
  CONSTRAINT "ShuttleRoutePlan_origin_coordinate_pair_check"
    CHECK (("originLatitude" IS NULL) = ("originLongitude" IS NULL)),
  CONSTRAINT "ShuttleRoutePlan_origin_latitude_range_check"
    CHECK ("originLatitude" IS NULL OR "originLatitude" BETWEEN -90 AND 90),
  CONSTRAINT "ShuttleRoutePlan_origin_longitude_range_check"
    CHECK ("originLongitude" IS NULL OR "originLongitude" BETWEEN -180 AND 180),
  CONSTRAINT "ShuttleRoutePlan_destination_coordinate_pair_check"
    CHECK (("destinationLatitude" IS NULL) = ("destinationLongitude" IS NULL)),
  CONSTRAINT "ShuttleRoutePlan_destination_latitude_range_check"
    CHECK ("destinationLatitude" IS NULL OR "destinationLatitude" BETWEEN -90 AND 90),
  CONSTRAINT "ShuttleRoutePlan_destination_longitude_range_check"
    CHECK ("destinationLongitude" IS NULL OR "destinationLongitude" BETWEEN -180 AND 180),
  CONSTRAINT "ShuttleRoutePlan_confirmation_check"
    CHECK (
      ("status" = 'CONFIRMED' AND "confirmedAt" IS NOT NULL AND "confirmedByUserId" IS NOT NULL)
      OR ("status" <> 'CONFIRMED')
    )
);

CREATE TABLE "ShuttleRouteStop" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "routePlanId" TEXT NOT NULL,
  "stopOrder" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "roadAddress" TEXT,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "plannedAt" TIMESTAMPTZ(6),
  "note" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShuttleRouteStop_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShuttleRouteStop_order_check" CHECK ("stopOrder" > 0),
  CONSTRAINT "ShuttleRouteStop_latitude_range_check" CHECK ("latitude" BETWEEN -90 AND 90),
  CONSTRAINT "ShuttleRouteStop_longitude_range_check" CHECK ("longitude" BETWEEN -180 AND 180)
);

CREATE TABLE "ShuttleRoutePassenger" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "routePlanId" TEXT NOT NULL,
  "stopId" TEXT NOT NULL,
  "shuttleRequestId" TEXT NOT NULL,
  "studentNameSnapshot" TEXT NOT NULL,
  "parentNameSnapshot" TEXT,
  "parentPhoneSnapshot" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShuttleRoutePassenger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShuttleAuditLog" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "routePlanId" TEXT,
  "vehicleId" TEXT,
  "shuttleRequestId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "beforeJSON" JSONB,
  "afterJSON" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShuttleAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShuttleVehicle_plateNumber_key" ON "ShuttleVehicle"("plateNumber");
CREATE INDEX "ShuttleVehicle_isActive_name_idx" ON "ShuttleVehicle"("isActive", "name");
CREATE UNIQUE INDEX "ShuttleRoutePlan_routeKey_version_key" ON "ShuttleRoutePlan"("routeKey", "version");
CREATE INDEX "ShuttleRoutePlan_seasonId_direction_status_idx" ON "ShuttleRoutePlan"("seasonId", "direction", "status");
CREATE INDEX "ShuttleRoutePlan_vehicleId_serviceDate_idx" ON "ShuttleRoutePlan"("vehicleId", "serviceDate");
CREATE INDEX "ShuttleRoutePlan_previousVersionId_idx" ON "ShuttleRoutePlan"("previousVersionId");
CREATE UNIQUE INDEX "ShuttleRouteStop_routePlanId_stopOrder_key" ON "ShuttleRouteStop"("routePlanId", "stopOrder");
CREATE UNIQUE INDEX "ShuttleRouteStop_id_routePlanId_key" ON "ShuttleRouteStop"("id", "routePlanId");
CREATE INDEX "ShuttleRouteStop_routePlanId_plannedAt_idx" ON "ShuttleRouteStop"("routePlanId", "plannedAt");
CREATE UNIQUE INDEX "ShuttleRoutePassenger_routePlanId_shuttleRequestId_key" ON "ShuttleRoutePassenger"("routePlanId", "shuttleRequestId");
CREATE INDEX "ShuttleRoutePassenger_stopId_idx" ON "ShuttleRoutePassenger"("stopId");
CREATE INDEX "ShuttleRoutePassenger_shuttleRequestId_idx" ON "ShuttleRoutePassenger"("shuttleRequestId");
CREATE INDEX "ShuttleAuditLog_routePlanId_createdAt_idx" ON "ShuttleAuditLog"("routePlanId", "createdAt");
CREATE INDEX "ShuttleAuditLog_vehicleId_createdAt_idx" ON "ShuttleAuditLog"("vehicleId", "createdAt");
CREATE INDEX "ShuttleAuditLog_shuttleRequestId_createdAt_idx" ON "ShuttleAuditLog"("shuttleRequestId", "createdAt");
CREATE INDEX "SpecialProgramShuttleRequest_assignedRouteId_idx" ON "SpecialProgramShuttleRequest"("assignedRouteId");
CREATE INDEX "SpecialProgramShuttleRequest_assignedStopId_idx" ON "SpecialProgramShuttleRequest"("assignedStopId");

ALTER TABLE "ShuttleRoutePlan"
  ADD CONSTRAINT "ShuttleRoutePlan_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "SpecialProgramSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ShuttleRoutePlan_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "ShuttleVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ShuttleRoutePlan_previousVersionId_fkey"
  FOREIGN KEY ("previousVersionId") REFERENCES "ShuttleRoutePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShuttleRouteStop"
  ADD CONSTRAINT "ShuttleRouteStop_routePlanId_fkey"
  FOREIGN KEY ("routePlanId") REFERENCES "ShuttleRoutePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShuttleRoutePassenger"
  ADD CONSTRAINT "ShuttleRoutePassenger_routePlanId_fkey"
  FOREIGN KEY ("routePlanId") REFERENCES "ShuttleRoutePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ShuttleRoutePassenger_stopId_fkey"
  FOREIGN KEY ("stopId") REFERENCES "ShuttleRouteStop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ShuttleRoutePassenger_stop_route_match_fkey"
  FOREIGN KEY ("stopId", "routePlanId") REFERENCES "ShuttleRouteStop"("id", "routePlanId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ShuttleRoutePassenger_shuttleRequestId_fkey"
  FOREIGN KEY ("shuttleRequestId") REFERENCES "SpecialProgramShuttleRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShuttleAuditLog"
  ADD CONSTRAINT "ShuttleAuditLog_routePlanId_fkey"
  FOREIGN KEY ("routePlanId") REFERENCES "ShuttleRoutePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ShuttleAuditLog_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "ShuttleVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ShuttleAuditLog_shuttleRequestId_fkey"
  FOREIGN KEY ("shuttleRequestId") REFERENCES "SpecialProgramShuttleRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Legacy assignedRouteId/assignedStopId may contain pre-existing free-form values.
-- They remain nullable compatibility pointers without foreign keys; ShuttleRoutePassenger is canonical.

-- 셔틀 위치·연락처 데이터는 서버 전용 Prisma 경로에서만 접근한다.
ALTER TABLE "ShuttleVehicle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShuttleRoutePlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShuttleRouteStop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShuttleRoutePassenger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShuttleAuditLog" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "ShuttleVehicle" FROM anon, authenticated;
REVOKE ALL ON TABLE "ShuttleRoutePlan" FROM anon, authenticated;
REVOKE ALL ON TABLE "ShuttleRouteStop" FROM anon, authenticated;
REVOKE ALL ON TABLE "ShuttleRoutePassenger" FROM anon, authenticated;
REVOKE ALL ON TABLE "ShuttleAuditLog" FROM anon, authenticated;
