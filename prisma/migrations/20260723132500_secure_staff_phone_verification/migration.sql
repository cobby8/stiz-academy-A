CREATE TABLE IF NOT EXISTS public."StaffPhoneVerification" (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ownerId" text NOT NULL,
  "phoneHash" text NOT NULL,
  "currentSendId" text,
  "otpHash" text,
  "otpExpiresAt" timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  "lockedAt" timestamptz,
  "lastSentAt" timestamptz,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SENT', 'VERIFIED', 'CONSUMED', 'FAILED')),
  "proofHash" text,
  "proofExpiresAt" timestamptz,
  "consumedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "StaffPhoneVerification_ownerId_phoneHash_key"
    UNIQUE ("ownerId", "phoneHash")
);

CREATE TABLE IF NOT EXISTS public."StaffPhoneVerificationSend" (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "verificationId" text NOT NULL
    REFERENCES public."StaffPhoneVerification"(id) ON DELETE CASCADE,
  "ownerId" text NOT NULL,
  "phoneHash" text NOT NULL,
  status text NOT NULL CHECK (status IN ('RESERVED', 'SENT', 'FAILED')),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."StaffPhoneVerification"
  ADD COLUMN IF NOT EXISTS "currentSendId" text;

CREATE INDEX IF NOT EXISTS "StaffPhoneVerification_ownerId_status_idx"
  ON public."StaffPhoneVerification" ("ownerId", status);
CREATE INDEX IF NOT EXISTS "StaffPhoneVerification_phoneHash_status_idx"
  ON public."StaffPhoneVerification" ("phoneHash", status);
CREATE INDEX IF NOT EXISTS "StaffPhoneVerificationSend_ownerId_createdAt_idx"
  ON public."StaffPhoneVerificationSend" ("ownerId", "createdAt");
CREATE INDEX IF NOT EXISTS "StaffPhoneVerificationSend_phoneHash_createdAt_idx"
  ON public."StaffPhoneVerificationSend" ("phoneHash", "createdAt");

ALTER TABLE public."StaffPhoneVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."StaffPhoneVerification" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."StaffPhoneVerificationSend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."StaffPhoneVerificationSend" FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."StaffPhoneVerification" FROM anon, authenticated;
REVOKE ALL ON TABLE public."StaffPhoneVerificationSend" FROM anon, authenticated;
