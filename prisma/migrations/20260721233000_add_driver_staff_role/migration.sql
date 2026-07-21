DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'DRIVER'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'DRIVER';
  END IF;
END $$;
