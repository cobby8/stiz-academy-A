DO $$
DECLARE definition TEXT;
BEGIN
  IF to_regclass('public."SessionPhotoDeletionJob"') IS NULL THEN
    RAISE EXCEPTION 'SessionPhotoDeletionJob is missing';
  END IF;
  SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
   WHERE conrelid = '"SessionPhotoDeletionJob"'::regclass AND contype = 'c'
     AND conname = 'SessionPhotoDeletionJob_status_check';
  IF definition IS NULL OR position('RESERVED' in definition) = 0 THEN
    RAISE EXCEPTION 'SessionPhotoDeletionJob status constraint does not include RESERVED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = '"SessionPhotoDeletionJob"'::regclass AND relrowsecurity)
    OR has_table_privilege('anon', '"SessionPhotoDeletionJob"', 'SELECT')
    OR has_table_privilege('authenticated', '"SessionPhotoDeletionJob"', 'SELECT') THEN
    RAISE EXCEPTION 'SessionPhotoDeletionJob RLS or grants are unsafe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
    AND indexname = 'SessionPhotoDeletionJob_photoId_key') THEN
    RAISE EXCEPTION 'SessionPhotoDeletionJob photo idempotency index is missing';
  END IF;
END $$;
