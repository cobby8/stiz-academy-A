DO $$
BEGIN
  IF to_regclass('public."StaffPaymentConfirmationRequest"') IS NULL THEN
    RAISE EXCEPTION 'G5 verification failed: staff payment confirmation table is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('paymentId'), ('invoiceId'), ('classId'), ('studentId'), ('requestedByUserId'),
      ('method'), ('amount'), ('receivedAt'), ('status')
    ) AS required(name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'StaffPaymentConfirmationRequest'
        AND column_name = required.name
    )
  ) THEN
    RAISE EXCEPTION 'G5 verification failed: staff payment confirmation columns are missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'StaffPaymentConfirmationRequest'
      AND column_name IN ('paymentId', 'invoiceId', 'classId', 'studentId', 'amount')
      AND is_nullable <> 'NO'
  ) THEN
    RAISE EXCEPTION 'G5 verification failed: confirmation identity columns must be required';
  END IF;

  IF (SELECT COUNT(*) FROM pg_constraint
      WHERE conrelid = 'public."StaffPaymentConfirmationRequest"'::regclass
        AND conname IN (
          'StaffPaymentConfirmationRequest_payment_identity_fkey',
          'StaffPaymentConfirmationRequest_invoice_identity_fkey'
        ) AND contype = 'f' AND convalidated) <> 2 THEN
    RAISE EXCEPTION 'G5 verification failed: confirmation identity foreign keys are missing';
  END IF;

  IF (SELECT COUNT(*) FROM pg_constraint
      WHERE conrelid = 'public."StaffPaymentConfirmationRequest"'::regclass
        AND conname IN (
          'StaffPaymentConfirmationRequest_payment_identity_fkey',
          'StaffPaymentConfirmationRequest_invoice_identity_fkey'
        ) AND confupdtype = 'c') <> 2 THEN
    RAISE EXCEPTION 'G5 verification failed: confirmation identity cascade is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
      AND tablename = 'StaffPaymentConfirmationRequest'
      AND indexname = 'StaffPaymentConfirmationRequest_one_pending'
  ) THEN
    RAISE EXCEPTION 'G5 verification failed: one-pending confirmation index is missing';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public."StaffPaymentConfirmationRequest"'::regclass) THEN
    RAISE EXCEPTION 'G5 verification failed: confirmation RLS is disabled';
  END IF;

  IF has_table_privilege('anon', 'public."StaffPaymentConfirmationRequest"', 'SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated', 'public."StaffPaymentConfirmationRequest"', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'G5 verification failed: confirmation table is exposed to Data API roles';
  END IF;
END $$;
