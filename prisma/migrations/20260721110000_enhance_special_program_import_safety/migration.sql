ALTER TABLE "SpecialProgramOffering"
  ALTER COLUMN "capacity" DROP NOT NULL,
  ADD COLUMN "newApplicantPrice" INTEGER,
  ADD COLUMN "existingApplicantPrice" INTEGER;

ALTER TABLE "SpecialProgramApplication"
  ADD COLUMN "applicantType" TEXT,
  ADD COLUMN "selectedWeekdays" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "importSource" TEXT,
  ADD COLUMN "sourceRowRef" TEXT,
  ADD COLUMN "requiresReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "SpecialProgramApplicationItem"
  ADD COLUMN "conversionStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "conversionError" TEXT;

ALTER TABLE "SpecialProgramApplicationItem"
  ADD CONSTRAINT "SpecialProgramApplicationItem_conversionStatus_check"
    CHECK ("conversionStatus" IN ('NOT_STARTED', 'INVOICE_PENDING', 'INVOICE_RETRY_REQUIRED', 'COMPLETED'));

ALTER TABLE "SpecialProgramOffering"
  ADD CONSTRAINT "SpecialProgramOffering_newApplicantPrice_check"
    CHECK ("newApplicantPrice" IS NULL OR "newApplicantPrice" >= 0),
  ADD CONSTRAINT "SpecialProgramOffering_existingApplicantPrice_check"
    CHECK ("existingApplicantPrice" IS NULL OR "existingApplicantPrice" >= 0),
  ADD CONSTRAINT "SpecialProgramOffering_open_capacity_check"
    CHECK (status <> 'OPEN' OR capacity IS NOT NULL);

ALTER TABLE "SpecialProgramApplication"
  ADD CONSTRAINT "SpecialProgramApplication_applicantType_check"
    CHECK ("applicantType" IS NULL OR "applicantType" IN ('NEW', 'EXISTING')),
  ADD CONSTRAINT "SpecialProgramApplication_import_reference_check"
    CHECK (("importSource" IS NULL) = ("sourceRowRef" IS NULL));

CREATE UNIQUE INDEX "SpecialProgramApplication_seasonId_importSource_sourceRowRef_key"
  ON "SpecialProgramApplication"("seasonId", "importSource", "sourceRowRef");

CREATE INDEX "SpecialProgramApplication_seasonId_requiresReview_createdAt_idx"
  ON "SpecialProgramApplication"("seasonId", "requiresReview", "createdAt");
