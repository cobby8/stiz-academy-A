DO $$
DECLARE issue_count INTEGER;
BEGIN
  IF to_regclass('public."MediaRevocationJob"') IS NULL
    OR to_regclass('public."SocialPublishAttempt"') IS NULL
    OR to_regclass('public."StorageDeletionJob"') IS NULL THEN
    RAISE EXCEPTION 'one or more media queue tables are missing';
  END IF;

  SELECT COUNT(*) INTO issue_count FROM pg_constraint
   WHERE conrelid IN ('"MediaRevocationJob"'::regclass, '"SocialPublishAttempt"'::regclass)
     AND contype = 'f';
  IF issue_count > 0 THEN
    RAISE EXCEPTION 'media audit tables still contain % source foreign keys', issue_count;
  END IF;
  SELECT COUNT(*) INTO issue_count FROM "MediaRevocationJob"
   WHERE jsonb_typeof(stiz_try_jsonb("draftSnapshotJSON") -> 'mediaJSON') IS DISTINCT FROM 'string'
      OR NOT COALESCE(stiz_try_jsonb("consentSnapshotJSON") ? 'revokedAt', false);
  IF issue_count > 0 THEN
    RAISE EXCEPTION '% revocation jobs lack durable consent/media processing evidence', issue_count;
  END IF;

  SELECT COUNT(*) INTO issue_count FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'MediaRevocationJob'
     AND column_name IN ('studentSnapshotJSON', 'consentSnapshotJSON', 'draftSnapshotJSON')
     AND is_nullable = 'NO';
  IF issue_count <> 3 THEN
    RAISE EXCEPTION 'required immutable snapshot columns are missing or nullable';
  END IF;

  SELECT COUNT(*) INTO issue_count FROM "MediaRevocationJob"
   WHERE "studentSnapshotJSON" IS NULL OR "studentSnapshotJSON" = '{}'
      OR "consentSnapshotJSON" IS NULL OR "consentSnapshotJSON" = '{}'
      OR "draftSnapshotJSON" IS NULL OR "draftSnapshotJSON" = '{}';
  IF issue_count > 0 THEN
    RAISE EXCEPTION '% revocation jobs have incomplete snapshots', issue_count;
  END IF;
  SELECT COUNT(*) INTO issue_count FROM "MediaRevocationJob"
   WHERE stiz_try_jsonb("studentSnapshotJSON") IS NULL
      OR stiz_try_jsonb("consentSnapshotJSON") IS NULL
      OR stiz_try_jsonb("draftSnapshotJSON") IS NULL;
  IF issue_count > 0 THEN
    RAISE EXCEPTION '% revocation jobs contain malformed snapshot JSON', issue_count;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = '"MediaRevocationJob"'::regclass AND relrowsecurity)
    OR has_table_privilege('anon', '"MediaRevocationJob"', 'SELECT')
    OR has_table_privilege('authenticated', '"MediaRevocationJob"', 'SELECT') THEN
    RAISE EXCEPTION 'MediaRevocationJob RLS or grants are unsafe';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
    AND indexname = 'MediaRevocationJob_consentId_draftId_channel_key') THEN
    RAISE EXCEPTION 'revocation idempotency index is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
    AND indexname = 'SocialPublishAttempt_idempotencyKey_key')
    OR NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
    AND indexname = 'StorageDeletionJob_bucket_path_key') THEN
    RAISE EXCEPTION 'publish/storage idempotency indexes are missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid = '"MediaRevocationJob"'::regclass
      AND tgname = 'MediaRevocationJob_snapshot_trigger' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'revocation snapshot trigger is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid = '"MediaRevocationJob"'::regclass
      AND tgname = 'MediaRevocationJob_snapshot_immutable_trigger' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'revocation snapshot immutability trigger is missing';
  END IF;
  SELECT COUNT(*) INTO issue_count FROM (VALUES
    ('MediaRevocationJob'), ('SocialPublishAttempt'), ('StorageDeletionJob')
  ) AS expected(name)
  WHERE NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.oid = format('public.%I', expected.name)::regclass AND c.relrowsecurity)
     OR has_table_privilege('anon', format('public.%I', expected.name), 'SELECT')
     OR has_table_privilege('authenticated', format('public.%I', expected.name), 'SELECT');
  IF issue_count > 0 THEN
    RAISE EXCEPTION '% media server-only tables have unsafe RLS or grants', issue_count;
  END IF;
END $$;
