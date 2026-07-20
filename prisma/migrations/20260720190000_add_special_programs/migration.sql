CREATE TABLE "SpecialProgramSeason" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "applicationOpensAt" TIMESTAMPTZ(6) NOT NULL,
  "applicationClosesAt" TIMESTAMPTZ(6) NOT NULL,
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "termsText" TEXT,
  "cancellationPolicy" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpecialProgramSeason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialProgramOffering" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "seasonId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "targetGrades" TEXT,
  "instructorId" TEXT,
  "instructorName" TEXT,
  "location" TEXT,
  "capacity" INTEGER NOT NULL,
  "price" INTEGER NOT NULL,
  "shuttleAvailable" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "linkedProgramId" TEXT,
  "linkedClassId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpecialProgramOffering_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpecialProgramOffering_capacity_check" CHECK ("capacity" >= 0),
  CONSTRAINT "SpecialProgramOffering_price_check" CHECK ("price" >= 0)
);

CREATE TABLE "SpecialProgramSessionDate" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "offeringId" TEXT NOT NULL,
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6) NOT NULL,
  "location" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpecialProgramSessionDate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpecialProgramSessionDate_time_check" CHECK ("endsAt" > "startsAt")
);

CREATE TABLE "SpecialProgramApplication" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "seasonId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "childName" TEXT NOT NULL,
  "childBirthDate" TIMESTAMPTZ(6) NOT NULL,
  "childGender" TEXT,
  "childGrade" TEXT,
  "childSchool" TEXT,
  "childPhone" TEXT,
  "parentName" TEXT NOT NULL,
  "parentPhone" TEXT NOT NULL,
  "parentRelation" TEXT,
  "address" TEXT,
  "memo" TEXT,
  "agreedTerms" BOOLEAN NOT NULL DEFAULT false,
  "agreedPrivacy" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "totalPriceSnapshot" INTEGER NOT NULL,
  "convertedStudentId" TEXT,
  "processedAt" TIMESTAMPTZ(6),
  "processedByUserId" TEXT,
  "processedNote" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpecialProgramApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpecialProgramApplication_price_check" CHECK ("totalPriceSnapshot" >= 0)
);

CREATE TABLE "SpecialProgramApplicationItem" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "applicationId" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "priceSnapshot" INTEGER NOT NULL,
  "titleSnapshot" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "waitlistOrder" INTEGER,
  "enrollmentId" TEXT,
  "paymentId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpecialProgramApplicationItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpecialProgramApplicationItem_price_check" CHECK ("priceSnapshot" >= 0)
);

CREATE TABLE "SpecialProgramShuttleRequest" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "applicationId" TEXT NOT NULL,
  "applicationItemId" TEXT NOT NULL,
  "pickupLocation" TEXT,
  "pickupTime" TEXT,
  "dropoffLocation" TEXT,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "assignedRouteId" TEXT,
  "assignedStopId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpecialProgramShuttleRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialProgramAuditLog" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "seasonId" TEXT,
  "offeringId" TEXT,
  "applicationId" TEXT,
  "itemId" TEXT,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "beforeJSON" JSONB,
  "afterJSON" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpecialProgramAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpecialProgramSeason_slug_key" ON "SpecialProgramSeason"("slug");
CREATE INDEX "SpecialProgramSeason_status_applicationOpensAt_applicationClosesAt_idx" ON "SpecialProgramSeason"("status", "applicationOpensAt", "applicationClosesAt");
CREATE UNIQUE INDEX "SpecialProgramOffering_seasonId_code_key" ON "SpecialProgramOffering"("seasonId", "code");
CREATE INDEX "SpecialProgramOffering_seasonId_status_displayOrder_idx" ON "SpecialProgramOffering"("seasonId", "status", "displayOrder");
CREATE UNIQUE INDEX "SpecialProgramSessionDate_offeringId_startsAt_key" ON "SpecialProgramSessionDate"("offeringId", "startsAt");
CREATE INDEX "SpecialProgramSessionDate_startsAt_idx" ON "SpecialProgramSessionDate"("startsAt");
CREATE UNIQUE INDEX "SpecialProgramApplication_seasonId_idempotencyKey_key" ON "SpecialProgramApplication"("seasonId", "idempotencyKey");
CREATE INDEX "SpecialProgramApplication_seasonId_status_createdAt_idx" ON "SpecialProgramApplication"("seasonId", "status", "createdAt");
CREATE INDEX "SpecialProgramApplication_parentPhone_createdAt_idx" ON "SpecialProgramApplication"("parentPhone", "createdAt");
CREATE UNIQUE INDEX "SpecialProgramApplicationItem_applicationId_offeringId_key" ON "SpecialProgramApplicationItem"("applicationId", "offeringId");
CREATE INDEX "SpecialProgramApplicationItem_offeringId_status_idx" ON "SpecialProgramApplicationItem"("offeringId", "status");
CREATE INDEX "SpecialProgramApplicationItem_offeringId_waitlistOrder_idx" ON "SpecialProgramApplicationItem"("offeringId", "waitlistOrder");
CREATE UNIQUE INDEX "SpecialProgramShuttleRequest_applicationItemId_key" ON "SpecialProgramShuttleRequest"("applicationItemId");
CREATE INDEX "SpecialProgramShuttleRequest_applicationId_status_idx" ON "SpecialProgramShuttleRequest"("applicationId", "status");
CREATE INDEX "SpecialProgramAuditLog_applicationId_createdAt_idx" ON "SpecialProgramAuditLog"("applicationId", "createdAt");
CREATE INDEX "SpecialProgramAuditLog_seasonId_createdAt_idx" ON "SpecialProgramAuditLog"("seasonId", "createdAt");

ALTER TABLE "SpecialProgramOffering" ADD CONSTRAINT "SpecialProgramOffering_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "SpecialProgramSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialProgramSessionDate" ADD CONSTRAINT "SpecialProgramSessionDate_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "SpecialProgramOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialProgramApplication" ADD CONSTRAINT "SpecialProgramApplication_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "SpecialProgramSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpecialProgramApplicationItem" ADD CONSTRAINT "SpecialProgramApplicationItem_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SpecialProgramApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialProgramApplicationItem" ADD CONSTRAINT "SpecialProgramApplicationItem_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "SpecialProgramOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpecialProgramShuttleRequest" ADD CONSTRAINT "SpecialProgramShuttleRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SpecialProgramApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialProgramShuttleRequest" ADD CONSTRAINT "SpecialProgramShuttleRequest_applicationItemId_fkey" FOREIGN KEY ("applicationItemId") REFERENCES "SpecialProgramApplicationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialProgramAuditLog" ADD CONSTRAINT "SpecialProgramAuditLog_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "SpecialProgramSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SpecialProgramAuditLog" ADD CONSTRAINT "SpecialProgramAuditLog_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "SpecialProgramOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SpecialProgramAuditLog" ADD CONSTRAINT "SpecialProgramAuditLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SpecialProgramApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SpecialProgramAuditLog" ADD CONSTRAINT "SpecialProgramAuditLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SpecialProgramApplicationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 개인정보와 운영 장부는 Next.js 서버의 직접 DB 연결로만 사용한다.
-- Supabase Data API의 anon/authenticated 역할에는 정책을 열지 않는다.
ALTER TABLE "SpecialProgramSeason" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpecialProgramOffering" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpecialProgramSessionDate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpecialProgramApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpecialProgramApplicationItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpecialProgramShuttleRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpecialProgramAuditLog" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "SpecialProgramSeason" FROM anon, authenticated;
REVOKE ALL ON TABLE "SpecialProgramOffering" FROM anon, authenticated;
REVOKE ALL ON TABLE "SpecialProgramSessionDate" FROM anon, authenticated;
REVOKE ALL ON TABLE "SpecialProgramApplication" FROM anon, authenticated;
REVOKE ALL ON TABLE "SpecialProgramApplicationItem" FROM anon, authenticated;
REVOKE ALL ON TABLE "SpecialProgramShuttleRequest" FROM anon, authenticated;
REVOKE ALL ON TABLE "SpecialProgramAuditLog" FROM anon, authenticated;
