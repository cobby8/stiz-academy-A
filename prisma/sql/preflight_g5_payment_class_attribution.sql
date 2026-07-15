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
    SELECT 1 FROM "Enrollment"
    GROUP BY "studentId", "classId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'G5 preflight failed: duplicate student/class enrollments exist';
  END IF;
END $$;
