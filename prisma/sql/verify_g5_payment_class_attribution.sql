DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'classId' AND is_nullable = 'YES'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PaymentInvoice' AND column_name = 'classId' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'G5 verification failed: nullable class attribution columns are missing';
  END IF;

  IF (SELECT COUNT(*) FROM pg_constraint WHERE conname IN (
    'Payment_classId_fkey', 'Payment_studentId_classId_fkey',
    'PaymentInvoice_classId_fkey', 'PaymentInvoice_studentId_classId_fkey',
    'PaymentInvoice_paymentId_classId_fkey'
  ) AND convalidated) <> 5 THEN
    RAISE EXCEPTION 'G5 verification failed: class/enrollment constraints are missing or unvalidated';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public."Payment"'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public."PaymentInvoice"'::regclass) THEN
    RAISE EXCEPTION 'G5 verification failed: billing RLS is disabled';
  END IF;

  IF has_table_privilege('anon', 'public."Payment"', 'SELECT')
     OR has_table_privilege('authenticated', 'public."Payment"', 'SELECT')
     OR has_table_privilege('anon', 'public."PaymentInvoice"', 'SELECT')
     OR has_table_privilege('authenticated', 'public."PaymentInvoice"', 'SELECT') THEN
    RAISE EXCEPTION 'G5 verification failed: public billing grants remain';
  END IF;
END $$;
