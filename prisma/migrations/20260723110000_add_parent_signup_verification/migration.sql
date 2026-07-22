ALTER TABLE "User" ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_lower_key"
  ON "User" (LOWER(username)) WHERE username IS NOT NULL;

-- Only verified phone numbers are unique. Imported legacy rows remain untouched,
-- while every new parent signup is protected from duplicate ownership.
CREATE UNIQUE INDEX IF NOT EXISTS "User_verified_phone_unique"
  ON "User" ((regexp_replace(phone, '[^0-9]', '', 'g')))
  WHERE "phoneVerifiedAt" IS NOT NULL AND phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS "ParentSignupVerification" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tokenHash" TEXT NOT NULL UNIQUE,
  username TEXT,
  name TEXT,
  phone TEXT NOT NULL,
  "phoneHash" TEXT NOT NULL,
  "signupMethod" TEXT NOT NULL DEFAULT 'PASSWORD',
  email TEXT,
  "pendingAuthUserId" TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "otpHash" TEXT,
  "otpExpiresAt" TIMESTAMPTZ,
  "otpSentAt" TIMESTAMPTZ,
  "otpAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedAt" TIMESTAMPTZ,
  "verifiedAt" TIMESTAMPTZ,
  "proofHash" TEXT,
  "proofExpiresAt" TIMESTAMPTZ,
  "processingAt" TIMESTAMPTZ,
  "processingAttemptId" TEXT,
  "authUserId" TEXT,
  "consumedAt" TIMESTAMPTZ,
  "termsAgreedAt" TIMESTAMPTZ,
  "termsVersion" TEXT,
  "privacyAgreedAt" TIMESTAMPTZ,
  "privacyVersion" TEXT,
  "ageConfirmedAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ParentSignupVerification_status_check"
    CHECK (status IN ('PENDING', 'VERIFIED', 'PROCESSING', 'CONSUMED', 'CANCELLED', 'RECOVERY_REQUIRED')),
  CONSTRAINT "ParentSignupVerification_tokenHash_check" CHECK (char_length("tokenHash") = 64),
  CONSTRAINT "ParentSignupVerification_phoneHash_check" CHECK (char_length("phoneHash") = 64),
  CONSTRAINT "ParentSignupVerification_signupMethod_check"
    CHECK ("signupMethod" IN ('PASSWORD', 'GOOGLE', 'KAKAO', 'NAVER'))
);
CREATE INDEX IF NOT EXISTS "ParentSignupVerification_username_status_createdAt_idx"
  ON "ParentSignupVerification" (username, status, "createdAt");
CREATE INDEX IF NOT EXISTS "ParentSignupVerification_phoneHash_createdAt_idx"
  ON "ParentSignupVerification" ("phoneHash", "createdAt");

CREATE TABLE IF NOT EXISTS "ParentSignupOtpSend" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "verificationId" TEXT NOT NULL REFERENCES "ParentSignupVerification"(id) ON DELETE CASCADE,
  "phoneHash" TEXT NOT NULL,
  "requestHash" TEXT,
  status TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ParentSignupOtpSend_phoneHash_check" CHECK (char_length("phoneHash") = 64),
  CONSTRAINT "ParentSignupOtpSend_status_check" CHECK (status IN ('RESERVED', 'SENT', 'FAILED'))
);
CREATE INDEX IF NOT EXISTS "ParentSignupOtpSend_verificationId_createdAt_idx"
  ON "ParentSignupOtpSend" ("verificationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ParentSignupOtpSend_phoneHash_createdAt_idx"
  ON "ParentSignupOtpSend" ("phoneHash", "createdAt");
CREATE INDEX IF NOT EXISTS "ParentSignupOtpSend_requestHash_createdAt_idx"
  ON "ParentSignupOtpSend" ("requestHash", "createdAt");

ALTER TABLE "ParentSignupVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentSignupVerification" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ParentSignupOtpSend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentSignupOtpSend" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ParentSignupVerification" FROM anon, authenticated;
REVOKE ALL ON TABLE "ParentSignupOtpSend" FROM anon, authenticated;
