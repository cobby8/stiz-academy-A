DO $$
BEGIN
  IF to_regclass('public."StudentMediaConsent"') IS NULL THEN
    RAISE EXCEPTION 'StudentMediaConsent table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public."StudentMediaConsent"'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'StudentMediaConsent RLS is disabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SocialPostDraft'
      AND column_name = 'subjectStudentIdsJSON'
  ) THEN
    RAISE EXCEPTION 'SocialPostDraft subject student column is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'PaymentWebhookEvent_provider_eventId_key'
  ) THEN
    RAISE EXCEPTION 'Payment webhook dedupe index is missing';
  END IF;

  IF has_table_privilege('anon', 'public."StudentMediaConsent"', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_table_privilege('authenticated', 'public."StudentMediaConsent"', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'Data API roles retain StudentMediaConsent privileges';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('NotificationDelivery'), ('PushSubscription'), ('Payment'), ('PaymentInvoice'),
      ('PaymentTransaction'), ('PaymentWebhookEvent'), ('PaymentAuditLog'), ('SocialPostDraft')
    ) AS protected(table_name)
    JOIN pg_class c ON c.oid = format('public.%I', protected.table_name)::regclass
    WHERE NOT c.relrowsecurity
       OR has_table_privilege('anon', format('public.%I', protected.table_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege('authenticated', format('public.%I', protected.table_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  ) THEN
    RAISE EXCEPTION 'One or more server-only G1 tables are exposed to Data API roles';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."NotificationDelivery"'::regclass
      AND conname = 'NotificationDelivery_status_check'
      AND pg_get_constraintdef(oid) LIKE '%PARTIAL%'
  ) THEN
    RAISE EXCEPTION 'NotificationDelivery PARTIAL status constraint is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."StudentMediaConsent"'::regclass
      AND contype = 'f'
      AND confrelid = 'public."Student"'::regclass
      AND confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'StudentMediaConsent student cascade foreign key is missing';
  END IF;
END $$;
