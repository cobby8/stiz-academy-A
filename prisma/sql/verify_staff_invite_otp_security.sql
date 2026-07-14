DO $$
DECLARE
  missing_count INTEGER;
  insecure_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM (VALUES
    ('otpHash'), ('otpExpiresAt'), ('otpSentAt'), ('otpAttempts'),
    ('otpVerifiedAt'), ('otpConsumedAt'), ('lockedAt'),
    ('processingAttemptId'), ('processingStartedAt'), ('recoveryOperationId'),
    ('recoveryAuthUserId'), ('recoveryError')
  ) AS expected(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'StaffInvitation'
      AND columns.column_name = expected.column_name
  );
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Missing % StaffInvitation security columns', missing_count;
  END IF;

  IF to_regclass('public."StaffInvitationOtpSend"') IS NULL
     OR to_regclass('public."StaffInvitationRecoveryLog"') IS NULL
     OR to_regclass('public."StaffInvitationAuthAttempt"') IS NULL THEN
    RAISE EXCEPTION 'One or more invitation security ledger tables are missing';
  END IF;

  SELECT COUNT(*) INTO missing_count
  FROM (VALUES
    ('StaffInvitationOtpSend', 'id'), ('StaffInvitationOtpSend', 'invitationId'),
    ('StaffInvitationOtpSend', 'phoneHash'), ('StaffInvitationOtpSend', 'requestHash'),
    ('StaffInvitationOtpSend', 'status'), ('StaffInvitationOtpSend', 'createdAt'),
    ('StaffInvitationRecoveryLog', 'id'), ('StaffInvitationRecoveryLog', 'invitationId'),
    ('StaffInvitationRecoveryLog', 'adminUserId'), ('StaffInvitationRecoveryLog', 'action'),
    ('StaffInvitationRecoveryLog', 'createdAt'),
    ('StaffInvitationAuthAttempt', 'id'), ('StaffInvitationAuthAttempt', 'invitationId'),
    ('StaffInvitationAuthAttempt', 'authUserId'), ('StaffInvitationAuthAttempt', 'status'),
    ('StaffInvitationAuthAttempt', 'error'), ('StaffInvitationAuthAttempt', 'createdAt'),
    ('StaffInvitationAuthAttempt', 'updatedAt')
  ) AS expected(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND columns.table_name = expected.table_name
      AND columns.column_name = expected.column_name
  );
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Missing % invitation ledger columns', missing_count;
  END IF;

  SELECT COUNT(*) INTO missing_count
  FROM (VALUES
    ('StaffInvitation_otpAttempts_check'), ('StaffInvitation_processing_state_check'),
    ('StaffInvitation_status_check'), ('StaffInvitationOtpSend_status_check'),
    ('StaffInvitationOtpSend_phoneHash_check'), ('StaffInvitationOtpSend_requestHash_check'),
    ('StaffInvitationRecoveryLog_action_check'), ('StaffInvitationAuthAttempt_status_check')
  ) AS expected(constraint_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = expected.constraint_name
  );
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Missing % invitation integrity constraints', missing_count;
  END IF;

  SELECT COUNT(*) INTO missing_count
  FROM (VALUES
    ('StaffInvitationOtpSend'), ('StaffInvitationRecoveryLog'), ('StaffInvitationAuthAttempt')
  ) AS expected(table_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = format('public.%I', expected.table_name)::regclass
      AND contype = 'f'
      AND confrelid = 'public."StaffInvitation"'::regclass
      AND confdeltype = 'c'
  );
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Missing % invitation cascade foreign keys', missing_count;
  END IF;

  SELECT COUNT(*) INTO missing_count
  FROM (VALUES
    ('StaffInvitation_processingAttemptId_key'),
    ('StaffInvitation_phone_status_idx'),
    ('StaffInvitationOtpSend_invitation_createdAt_idx'),
    ('StaffInvitationOtpSend_phoneHash_createdAt_idx'),
    ('StaffInvitationOtpSend_requestHash_createdAt_idx'),
    ('StaffInvitationRecoveryLog_invitation_createdAt_idx'),
    ('StaffInvitationAuthAttempt_invitation_createdAt_idx'),
    ('StaffInvitationAuthAttempt_authUserId_idx')
  ) AS expected(index_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = expected.index_name
  );
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Missing % invitation security indexes', missing_count;
  END IF;

  SELECT COUNT(*) INTO insecure_count
  FROM pg_class
  WHERE oid IN (
    'public."StaffInvitation"'::regclass,
    'public."StaffInvitationOtpSend"'::regclass,
    'public."StaffInvitationRecoveryLog"'::regclass,
    'public."StaffInvitationAuthAttempt"'::regclass
  ) AND NOT relrowsecurity;
  IF insecure_count > 0 THEN
    RAISE EXCEPTION 'RLS is disabled on % invitation tables', insecure_count;
  END IF;

  SELECT COUNT(*) INTO insecure_count
  FROM (VALUES
    ('StaffInvitation'), ('StaffInvitationOtpSend'),
    ('StaffInvitationRecoveryLog'), ('StaffInvitationAuthAttempt')
  ) AS protected(table_name)
  WHERE has_table_privilege('anon', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');
  IF insecure_count > 0 THEN
    RAISE EXCEPTION 'Data API roles retain privileges on % invitation tables', insecure_count;
  END IF;

  SELECT COUNT(*) INTO insecure_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'StaffInvitation', 'StaffInvitationOtpSend',
      'StaffInvitationRecoveryLog', 'StaffInvitationAuthAttempt'
    );
  IF insecure_count > 0 THEN
    RAISE EXCEPTION 'Unexpected RLS policies exist on invitation tables';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."StaffInvitation"'::regclass
      AND conname = 'StaffInvitation_processing_state_check'
  ) THEN
    RAISE EXCEPTION 'Invitation processing state constraint is missing';
  END IF;
END $$;
