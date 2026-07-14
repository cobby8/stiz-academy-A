DO $$
DECLARE
  unsafe_rows INTEGER;
BEGIN
  IF to_regclass('public."StaffInvitation"') IS NULL THEN
    RAISE EXCEPTION 'StaffInvitation table does not exist';
  END IF;

  SELECT COUNT(*) INTO unsafe_rows
  FROM "StaffInvitation"
  WHERE status IN ('PROCESSING', 'RECOVERY_REQUIRED', 'RECOVERING');

  IF unsafe_rows > 0 THEN
    RAISE EXCEPTION 'Found % in-flight invitation rows; recover them before migration', unsafe_rows;
  END IF;

  SELECT COUNT(*) INTO unsafe_rows
  FROM "StaffInvitation"
  WHERE status IS NULL OR status NOT IN ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

  IF unsafe_rows > 0 THEN
    RAISE EXCEPTION 'Found % invitation rows with unsupported status', unsafe_rows;
  END IF;
END $$;
