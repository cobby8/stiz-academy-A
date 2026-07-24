ALTER TABLE "SpecialProgramOffering"
ADD COLUMN "shuttleFee" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SpecialProgramApplicationItem"
ADD COLUMN "tuitionPriceSnapshot" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "shuttleFeeSnapshot" INTEGER NOT NULL DEFAULT 0;

UPDATE "SpecialProgramApplicationItem"
SET "tuitionPriceSnapshot" = "priceSnapshot";

ALTER TABLE "SpecialProgramOffering"
ADD CONSTRAINT "SpecialProgramOffering_shuttleFee_nonnegative"
CHECK ("shuttleFee" >= 0);

ALTER TABLE "SpecialProgramApplicationItem"
ADD CONSTRAINT "SpecialProgramApplicationItem_tuitionPriceSnapshot_nonnegative"
CHECK ("tuitionPriceSnapshot" >= 0),
ADD CONSTRAINT "SpecialProgramApplicationItem_shuttleFeeSnapshot_nonnegative"
CHECK ("shuttleFeeSnapshot" >= 0),
ADD CONSTRAINT "SpecialProgramApplicationItem_priceSnapshot_components"
CHECK ("priceSnapshot" = "tuitionPriceSnapshot" + "shuttleFeeSnapshot");
