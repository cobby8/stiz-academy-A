CREATE TABLE "EnrollmentShortLink" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "code" TEXT NOT NULL,
    "trialLeadId" TEXT NOT NULL,
    "targetPath" TEXT NOT NULL DEFAULT '/apply/enroll',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnrollmentShortLink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EnrollmentShortLink_code_key" UNIQUE ("code"),
    CONSTRAINT "EnrollmentShortLink_trialLeadId_fkey"
        FOREIGN KEY ("trialLeadId") REFERENCES "TrialLead"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EnrollmentShortLink_code_format_check"
        CHECK ("code" ~ '^[A-Za-z0-9_-]{16}$'),
    CONSTRAINT "EnrollmentShortLink_target_path_check"
        CHECK ("targetPath" = '/apply/enroll')
);

CREATE INDEX "EnrollmentShortLink_trialLeadId_isActive_expiresAt_idx"
    ON "EnrollmentShortLink"("trialLeadId", "isActive", "expiresAt");
CREATE INDEX "EnrollmentShortLink_expiresAt_idx"
    ON "EnrollmentShortLink"("expiresAt");

ALTER TABLE "EnrollmentShortLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EnrollmentShortLink" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "EnrollmentShortLink" FROM anon, authenticated;
