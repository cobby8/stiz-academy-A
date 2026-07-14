-- 스태프 초대 전화번호 인증을 서버 메모리가 아닌 DB에 안전하게 보관한다.
-- 운영 반영 전 별도 승인과 백업 확인이 필요하다.

BEGIN;

ALTER TABLE "StaffInvitation"
  ADD COLUMN IF NOT EXISTS "otpHash" TEXT,
  ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "otpSentAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "otpAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "otpVerifiedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "otpConsumedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "processingAttemptId" TEXT,
  ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "recoveryOperationId" TEXT,
  ADD COLUMN IF NOT EXISTS "recoveryAuthUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "recoveryError" TEXT;

ALTER TABLE "StaffInvitation"
  DROP CONSTRAINT IF EXISTS "StaffInvitation_otpAttempts_check";
ALTER TABLE "StaffInvitation"
  ADD CONSTRAINT "StaffInvitation_otpAttempts_check" CHECK ("otpAttempts" >= 0 AND "otpAttempts" <= 5);

ALTER TABLE "StaffInvitation"
  DROP CONSTRAINT IF EXISTS "StaffInvitation_processing_state_check";
ALTER TABLE "StaffInvitation"
  ADD CONSTRAINT "StaffInvitation_processing_state_check" CHECK (
    (status IN ('PROCESSING', 'RECOVERY_REQUIRED', 'RECOVERING') AND "processingAttemptId" IS NOT NULL AND "processingStartedAt" IS NOT NULL)
    OR
    (status NOT IN ('PROCESSING', 'RECOVERY_REQUIRED', 'RECOVERING') AND "processingAttemptId" IS NULL AND "processingStartedAt" IS NULL)
  );

CREATE TABLE IF NOT EXISTS "StaffInvitationOtpSend" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invitationId" TEXT NOT NULL REFERENCES "StaffInvitation"(id) ON DELETE CASCADE,
  "phoneHash" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  status TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "StaffInvitationOtpSend_status_check"
    CHECK (status IN ('RESERVED', 'SENT', 'FAILED', 'TIMEOUT')),
  CONSTRAINT "StaffInvitationOtpSend_phoneHash_check" CHECK (char_length("phoneHash") = 64),
  CONSTRAINT "StaffInvitationOtpSend_requestHash_check" CHECK (char_length("requestHash") = 64)
);

CREATE INDEX IF NOT EXISTS "StaffInvitation_phone_status_idx"
  ON "StaffInvitation" (phone, status);
CREATE INDEX IF NOT EXISTS "StaffInvitationOtpSend_invitation_createdAt_idx"
  ON "StaffInvitationOtpSend" ("invitationId", "createdAt");
CREATE INDEX IF NOT EXISTS "StaffInvitationOtpSend_phoneHash_createdAt_idx"
  ON "StaffInvitationOtpSend" ("phoneHash", "createdAt");
CREATE INDEX IF NOT EXISTS "StaffInvitationOtpSend_requestHash_createdAt_idx"
  ON "StaffInvitationOtpSend" ("requestHash", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffInvitation_processingAttemptId_key"
  ON "StaffInvitation" ("processingAttemptId") WHERE "processingAttemptId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "StaffInvitationRecoveryLog" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invitationId" TEXT NOT NULL REFERENCES "StaffInvitation"(id) ON DELETE CASCADE,
  "adminUserId" TEXT NOT NULL,
  action TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "StaffInvitationRecoveryLog_action_check" CHECK (action IN ('RESET_TO_PENDING'))
);

CREATE INDEX IF NOT EXISTS "StaffInvitationRecoveryLog_invitation_createdAt_idx"
  ON "StaffInvitationRecoveryLog" ("invitationId", "createdAt");

CREATE TABLE IF NOT EXISTS "StaffInvitationAuthAttempt" (
  id TEXT PRIMARY KEY,
  "invitationId" TEXT NOT NULL REFERENCES "StaffInvitation"(id) ON DELETE CASCADE,
  "authUserId" TEXT,
  status TEXT NOT NULL,
  error TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "StaffInvitationAuthAttempt_status_check"
    CHECK (status IN ('CREATING', 'CREATED', 'COMPLETED', 'DELETED', 'RECOVERY_REQUIRED'))
);

CREATE INDEX IF NOT EXISTS "StaffInvitationAuthAttempt_invitation_createdAt_idx"
  ON "StaffInvitationAuthAttempt" ("invitationId", "createdAt");
CREATE INDEX IF NOT EXISTS "StaffInvitationAuthAttempt_authUserId_idx"
  ON "StaffInvitationAuthAttempt" ("authUserId");

ALTER TABLE "StaffInvitation"
  DROP CONSTRAINT IF EXISTS "StaffInvitation_status_check";
ALTER TABLE "StaffInvitation"
  ADD CONSTRAINT "StaffInvitation_status_check"
  CHECK (status IN ('PENDING', 'PROCESSING', 'RECOVERY_REQUIRED', 'RECOVERING', 'ACCEPTED', 'CANCELLED', 'EXPIRED'));

-- 이 데이터는 서버 액션만 직접 사용한다. Supabase Data API의 공개/일반 로그인 역할에는 노출하지 않는다.
ALTER TABLE "StaffInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffInvitationOtpSend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffInvitationRecoveryLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffInvitationAuthAttempt" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "StaffInvitation" FROM anon, authenticated;
REVOKE ALL ON TABLE "StaffInvitationOtpSend" FROM anon, authenticated;
REVOKE ALL ON TABLE "StaffInvitationRecoveryLog" FROM anon, authenticated;
REVOKE ALL ON TABLE "StaffInvitationAuthAttempt" FROM anon, authenticated;

COMMIT;
