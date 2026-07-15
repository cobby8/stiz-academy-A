DO $$
DECLARE duplicate_count BIGINT;
BEGIN
  IF to_regclass('public."Student"') IS NULL
    OR to_regclass('public."StudentMediaConsent"') IS NULL
    OR to_regclass('public."SocialPostDraft"') IS NULL THEN
    RAISE EXCEPTION 'media revocation prerequisites are missing';
  END IF;

  IF to_regclass('public."MediaRevocationJob"') IS NOT NULL THEN
    SELECT COUNT(*) INTO duplicate_count FROM (
      SELECT "consentId", "draftId", channel
      FROM "MediaRevocationJob"
      GROUP BY "consentId", "draftId", channel HAVING COUNT(*) > 1
    ) duplicates;
    IF duplicate_count > 0 THEN
      RAISE EXCEPTION 'MediaRevocationJob has % duplicate consent/draft/channel groups', duplicate_count;
    END IF;
  END IF;

  IF to_regclass('public."SocialPublishAttempt"') IS NOT NULL THEN
    SELECT COUNT(*) INTO duplicate_count FROM (
      SELECT "idempotencyKey" FROM "SocialPublishAttempt"
      GROUP BY "idempotencyKey" HAVING COUNT(*) > 1
    ) duplicates;
    IF duplicate_count > 0 THEN
      RAISE EXCEPTION 'SocialPublishAttempt has % duplicate idempotency keys', duplicate_count;
    END IF;
  END IF;

  IF to_regclass('public."StorageDeletionJob"') IS NOT NULL THEN
    SELECT COUNT(*) INTO duplicate_count FROM (
      SELECT bucket, path FROM "StorageDeletionJob"
      GROUP BY bucket, path HAVING COUNT(*) > 1
    ) duplicates;
    IF duplicate_count > 0 THEN
      RAISE EXCEPTION 'StorageDeletionJob has % duplicate bucket/path groups', duplicate_count;
    END IF;
  END IF;
END $$;
