DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES ('payloadJSON'), ('nextAttemptAt'), ('lockedAt'), ('lockToken')) AS required(name)
    WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'NotificationDelivery' AND column_name = required.name)
  ) THEN RAISE EXCEPTION 'NotificationDelivery push outbox columns are missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
      AND tablename = 'NotificationDelivery'
      AND indexname = 'NotificationDelivery_push_outbox_claim_idx'
  ) THEN RAISE EXCEPTION 'NotificationDelivery push outbox claim index is missing'; END IF;
END $$;
