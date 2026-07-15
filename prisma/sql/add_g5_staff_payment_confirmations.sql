BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_confirmation_identity_key"
  ON "Payment" (id, "classId", "studentId", amount);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentInvoice_confirmation_identity_key"
  ON "PaymentInvoice" (id, "paymentId", "classId", "studentId", amount);

CREATE TABLE IF NOT EXISTS "StaffPaymentConfirmationRequest" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "paymentId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL REFERENCES "Student"(id) ON DELETE RESTRICT,
  "requestedByUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  method TEXT NOT NULL CHECK (method IN ('CASH','BANK_TRANSFER')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  "receivedAt" TIMESTAMPTZ(6) NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  "reviewedByUserId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "reviewedAt" TIMESTAMPTZ(6), "reviewNote" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "StaffPaymentConfirmationRequest_payment_identity_fkey"
    FOREIGN KEY ("paymentId", "classId", "studentId", amount)
    REFERENCES "Payment"(id, "classId", "studentId", amount)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "StaffPaymentConfirmationRequest_invoice_identity_fkey"
    FOREIGN KEY ("invoiceId", "paymentId", "classId", "studentId", amount)
    REFERENCES "PaymentInvoice"(id, "paymentId", "classId", "studentId", amount)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "StaffPaymentConfirmationRequest" WHERE "invoiceId" IS NULL) THEN
    RAISE EXCEPTION 'G5 staff confirmation migration failed: legacy rows have no invoiceId';
  END IF;

  ALTER TABLE "StaffPaymentConfirmationRequest"
    ALTER COLUMN "invoiceId" SET NOT NULL,
    ALTER COLUMN "classId" SET NOT NULL;
  ALTER TABLE "StaffPaymentConfirmationRequest"
    DROP CONSTRAINT IF EXISTS "StaffPaymentConfirmationRequest_paymentId_fkey",
    DROP CONSTRAINT IF EXISTS "StaffPaymentConfirmationRequest_invoiceId_fkey",
    DROP CONSTRAINT IF EXISTS "StaffPaymentConfirmationRequest_classId_fkey",
    DROP CONSTRAINT IF EXISTS "StaffPaymentConfirmationRequest_payment_identity_fkey",
    DROP CONSTRAINT IF EXISTS "StaffPaymentConfirmationRequest_invoice_identity_fkey";

  ALTER TABLE "StaffPaymentConfirmationRequest"
    ADD CONSTRAINT "StaffPaymentConfirmationRequest_payment_identity_fkey"
    FOREIGN KEY ("paymentId", "classId", "studentId", amount)
    REFERENCES "Payment"(id, "classId", "studentId", amount)
    ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID,
    ADD CONSTRAINT "StaffPaymentConfirmationRequest_invoice_identity_fkey"
    FOREIGN KEY ("invoiceId", "paymentId", "classId", "studentId", amount)
    REFERENCES "PaymentInvoice"(id, "paymentId", "classId", "studentId", amount)
    ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
END $$;

ALTER TABLE "StaffPaymentConfirmationRequest"
  VALIDATE CONSTRAINT "StaffPaymentConfirmationRequest_payment_identity_fkey";
ALTER TABLE "StaffPaymentConfirmationRequest"
  VALIDATE CONSTRAINT "StaffPaymentConfirmationRequest_invoice_identity_fkey";
CREATE UNIQUE INDEX IF NOT EXISTS "StaffPaymentConfirmationRequest_one_pending"
  ON "StaffPaymentConfirmationRequest" ("paymentId") WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS "StaffPaymentConfirmationRequest_status_createdAt_idx" ON "StaffPaymentConfirmationRequest" (status,"createdAt");
CREATE INDEX IF NOT EXISTS "StaffPaymentConfirmationRequest_classId_status_idx" ON "StaffPaymentConfirmationRequest" ("classId",status);
ALTER TABLE "StaffPaymentConfirmationRequest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "StaffPaymentConfirmationRequest" FROM anon, authenticated;
COMMIT;
