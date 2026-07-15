BEGIN;
CREATE TABLE IF NOT EXISTS "StaffPaymentConfirmationRequest" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "paymentId" TEXT NOT NULL REFERENCES "Payment"(id) ON DELETE RESTRICT,
  "invoiceId" TEXT REFERENCES "PaymentInvoice"(id) ON DELETE RESTRICT,
  "classId" TEXT NOT NULL REFERENCES "Class"(id) ON DELETE RESTRICT,
  "studentId" TEXT NOT NULL REFERENCES "Student"(id) ON DELETE RESTRICT,
  "requestedByUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  method TEXT NOT NULL CHECK (method IN ('CASH','BANK_TRANSFER')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  "receivedAt" TIMESTAMPTZ(6) NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  "reviewedByUserId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "reviewedAt" TIMESTAMPTZ(6), "reviewNote" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffPaymentConfirmationRequest_one_pending"
  ON "StaffPaymentConfirmationRequest" ("paymentId") WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS "StaffPaymentConfirmationRequest_status_createdAt_idx" ON "StaffPaymentConfirmationRequest" (status,"createdAt");
CREATE INDEX IF NOT EXISTS "StaffPaymentConfirmationRequest_classId_status_idx" ON "StaffPaymentConfirmationRequest" ("classId",status);
ALTER TABLE "StaffPaymentConfirmationRequest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "StaffPaymentConfirmationRequest" FROM anon, authenticated;
COMMIT;
