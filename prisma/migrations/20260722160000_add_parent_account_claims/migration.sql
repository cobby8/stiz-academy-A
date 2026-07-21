ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authUserId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_authUserId_key" ON "User" ("authUserId");

CREATE TABLE IF NOT EXISTS "ParentAccountClaim" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "parentId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "applicationId" TEXT,
  "invoiceId" TEXT,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "phoneHash" TEXT NOT NULL,
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
  "consumedAt" TIMESTAMPTZ,
  "authUserId" TEXT,
  "processingAt" TIMESTAMPTZ,
  "processingAttemptId" TEXT,
  "redirectPath" TEXT NOT NULL DEFAULT '/mypage',
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ParentAccountClaim_status_check"
    CHECK (status IN ('PENDING', 'VERIFIED', 'PROCESSING', 'CONSUMED', 'CANCELLED', 'RECOVERY_REQUIRED')),
  CONSTRAINT "ParentAccountClaim_tokenHash_check" CHECK (char_length("tokenHash") = 64),
  CONSTRAINT "ParentAccountClaim_phoneHash_check" CHECK (char_length("phoneHash") = 64),
  CONSTRAINT "ParentAccountClaim_redirectPath_check" CHECK ("redirectPath" LIKE '/%' AND "redirectPath" NOT LIKE '//%')
);

CREATE INDEX IF NOT EXISTS "ParentAccountClaim_parentId_status_createdAt_idx"
  ON "ParentAccountClaim" ("parentId", status, "createdAt");
CREATE INDEX IF NOT EXISTS "ParentAccountClaim_phoneHash_createdAt_idx"
  ON "ParentAccountClaim" ("phoneHash", "createdAt");
CREATE INDEX IF NOT EXISTS "ParentAccountClaim_applicationId_idx"
  ON "ParentAccountClaim" ("applicationId");
CREATE INDEX IF NOT EXISTS "ParentAccountClaim_invoiceId_idx"
  ON "ParentAccountClaim" ("invoiceId");

CREATE TABLE IF NOT EXISTS "ParentAccountClaimOtpSend" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "claimId" TEXT NOT NULL REFERENCES "ParentAccountClaim"(id) ON DELETE CASCADE,
  "phoneHash" TEXT NOT NULL,
  status TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ParentAccountClaimOtpSend_phoneHash_check" CHECK (char_length("phoneHash") = 64),
  CONSTRAINT "ParentAccountClaimOtpSend_status_check" CHECK (status IN ('RESERVED', 'SENT', 'FAILED', 'TIMEOUT'))
);
CREATE INDEX IF NOT EXISTS "ParentAccountClaimOtpSend_claimId_createdAt_idx"
  ON "ParentAccountClaimOtpSend" ("claimId", "createdAt");
CREATE INDEX IF NOT EXISTS "ParentAccountClaimOtpSend_phoneHash_createdAt_idx"
  ON "ParentAccountClaimOtpSend" ("phoneHash", "createdAt");

ALTER TABLE "ParentAccountClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentAccountClaim" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ParentAccountClaimOtpSend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentAccountClaimOtpSend" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ParentAccountClaim" FROM anon, authenticated;
REVOKE ALL ON TABLE "ParentAccountClaimOtpSend" FROM anon, authenticated;
