SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='StaffPaymentConfirmationRequest'
 ORDER BY ordinal_position;
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='StaffPaymentConfirmationRequest';
SELECT relrowsecurity FROM pg_class WHERE oid='public."StaffPaymentConfirmationRequest"'::regclass;
