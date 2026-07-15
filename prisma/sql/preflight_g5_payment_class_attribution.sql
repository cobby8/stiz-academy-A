-- Read-only preflight. Run before add_g5_payment_class_attribution.sql.
DO $$
BEGIN
  IF to_regclass('public."Payment"') IS NULL
     OR to_regclass('public."PaymentInvoice"') IS NULL
     OR to_regclass('public."Enrollment"') IS NULL
     OR to_regclass('public."Class"') IS NULL THEN
    RAISE EXCEPTION 'G5 preflight failed: required billing or class tables are missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PaymentInvoice' AND column_name = 'classId'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'classId'
    ) THEN
      IF EXISTS (
        SELECT 1
        FROM "PaymentInvoice" i
        JOIN "Payment" p ON p.id = i."paymentId"
        WHERE i."classId" IS DISTINCT FROM p."classId"
      ) THEN
        RAISE EXCEPTION 'G5 preflight failed: invoice class attribution differs from its payment';
      END IF;
    END IF;
  END IF;
END $$;
