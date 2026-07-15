CREATE TABLE IF NOT EXISTS "ApplicationContactLog" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "targetType" TEXT NOT NULL,
    "trialLeadId" TEXT,
    "enrollmentApplicationId" TEXT,
    action TEXT NOT NULL,
    note TEXT,
    "nextFollowUpAt" TIMESTAMPTZ,
    "followUpCompletedAt" TIMESTAMPTZ,
    "createdByUserId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "ApplicationContactLog_target_check" CHECK (
        ("targetType" = 'TRIAL' AND "trialLeadId" IS NOT NULL AND "enrollmentApplicationId" IS NULL)
        OR
        ("targetType" = 'ENROLL' AND "enrollmentApplicationId" IS NOT NULL AND "trialLeadId" IS NULL)
    ),
    CONSTRAINT "ApplicationContactLog_action_check" CHECK (
        action IN ('CONTACTED', 'NO_ANSWER', 'FOLLOW_UP', 'MEMO')
    )
);

CREATE INDEX IF NOT EXISTS "ApplicationContactLog_trial_createdAt_idx"
    ON "ApplicationContactLog" ("trialLeadId", "createdAt" DESC)
    WHERE "targetType" = 'TRIAL';

CREATE INDEX IF NOT EXISTS "ApplicationContactLog_enroll_createdAt_idx"
    ON "ApplicationContactLog" ("enrollmentApplicationId", "createdAt" DESC)
    WHERE "targetType" = 'ENROLL';

CREATE INDEX IF NOT EXISTS "ApplicationContactLog_trial_followup_idx"
    ON "ApplicationContactLog" ("trialLeadId", "nextFollowUpAt")
    WHERE "targetType" = 'TRIAL'
      AND "nextFollowUpAt" IS NOT NULL
      AND "followUpCompletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "ApplicationContactLog_enroll_followup_idx"
    ON "ApplicationContactLog" ("enrollmentApplicationId", "nextFollowUpAt")
    WHERE "targetType" = 'ENROLL'
      AND "nextFollowUpAt" IS NOT NULL
      AND "followUpCompletedAt" IS NULL;

ALTER TABLE "ApplicationContactLog" ENABLE ROW LEVEL SECURITY;
