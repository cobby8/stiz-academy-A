BEGIN;

-- Existing rows deliberately remain NULL. Guessing a class from current enrollment
-- could expose historical charges to the wrong teacher.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "classId" TEXT;
ALTER TABLE "PaymentInvoice" ADD COLUMN IF NOT EXISTS "classId" TEXT;

CREATE INDEX IF NOT EXISTS "Payment_classId_status_dueDate_idx"
  ON "Payment" ("classId", status, "dueDate");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_id_classId_key"
  ON "Payment" (id, "classId");
CREATE INDEX IF NOT EXISTS "PaymentInvoice_classId_status_dueDate_idx"
  ON "PaymentInvoice" ("classId", status, "dueDate");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_classId_fkey') THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "Class"(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_studentId_classId_fkey') THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_studentId_classId_fkey"
      FOREIGN KEY ("studentId", "classId") REFERENCES "Enrollment"("studentId", "classId")
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentInvoice_classId_fkey') THEN
    ALTER TABLE "PaymentInvoice"
      ADD CONSTRAINT "PaymentInvoice_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "Class"(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentInvoice_studentId_classId_fkey') THEN
    ALTER TABLE "PaymentInvoice"
      ADD CONSTRAINT "PaymentInvoice_studentId_classId_fkey"
      FOREIGN KEY ("studentId", "classId") REFERENCES "Enrollment"("studentId", "classId")
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentInvoice_paymentId_classId_fkey') THEN
    ALTER TABLE "PaymentInvoice"
      ADD CONSTRAINT "PaymentInvoice_paymentId_classId_fkey"
      FOREIGN KEY ("paymentId", "classId") REFERENCES "Payment"(id, "classId")
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

ALTER TABLE "Payment" VALIDATE CONSTRAINT "Payment_classId_fkey";
ALTER TABLE "Payment" VALIDATE CONSTRAINT "Payment_studentId_classId_fkey";
ALTER TABLE "PaymentInvoice" VALIDATE CONSTRAINT "PaymentInvoice_classId_fkey";
ALTER TABLE "PaymentInvoice" VALIDATE CONSTRAINT "PaymentInvoice_studentId_classId_fkey";
ALTER TABLE "PaymentInvoice" VALIDATE CONSTRAINT "PaymentInvoice_paymentId_classId_fkey";

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentInvoice" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Payment" FROM anon, authenticated;
REVOKE ALL ON TABLE "PaymentInvoice" FROM anon, authenticated;

COMMIT;
