import { prisma } from "@/lib/prisma";
import { APPLICATION_CONTACT_ACTION_CONSTRAINT_SQL } from "@/lib/application-contact-actions";

export {
    APPLICATION_CONTACT_ACTIONS,
    APPLICATION_CONTACT_ACTION_CONSTRAINT_SQL,
    type ApplicationContactAction,
} from "@/lib/application-contact-actions";

export type ApplicationContactTargetType = "TRIAL" | "ENROLL";

let _applicationContactLogEnsured = false;

export async function ensureApplicationContactLogInfrastructure() {
    if (_applicationContactLogEnsured) return;

    await prisma.$executeRawUnsafe(`
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
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    const columns: [string, string][] = [
        ["targetType", "TEXT NOT NULL DEFAULT 'TRIAL'"],
        ["trialLeadId", "TEXT"],
        ["enrollmentApplicationId", "TEXT"],
        ["action", "TEXT NOT NULL DEFAULT 'MEMO'"],
        ["note", "TEXT"],
        ["nextFollowUpAt", "TIMESTAMPTZ"],
        ["followUpCompletedAt", "TIMESTAMPTZ"],
        ["createdByUserId", "TEXT"],
        ["createdByName", "TEXT"],
        ["createdAt", "TIMESTAMPTZ NOT NULL DEFAULT NOW()"],
        ["updatedAt", "TIMESTAMPTZ NOT NULL DEFAULT NOW()"],
    ];

    for (const [column, type] of columns) {
        await prisma.$executeRawUnsafe(
            `ALTER TABLE "ApplicationContactLog" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
        );
    }

    // CREATE TABLE IF NOT EXISTS does not update constraints on an existing
    // installation. Replacing the constraint in one ALTER TABLE statement is
    // atomic and safe to run for both new and upgraded databases.
    await prisma.$executeRawUnsafe(APPLICATION_CONTACT_ACTION_CONSTRAINT_SQL);

    const indexes = [
        `CREATE INDEX IF NOT EXISTS "ApplicationContactLog_trial_createdAt_idx"
         ON "ApplicationContactLog" ("trialLeadId", "createdAt" DESC)
         WHERE "targetType" = 'TRIAL'`,
        `CREATE INDEX IF NOT EXISTS "ApplicationContactLog_enroll_createdAt_idx"
         ON "ApplicationContactLog" ("enrollmentApplicationId", "createdAt" DESC)
         WHERE "targetType" = 'ENROLL'`,
        `CREATE INDEX IF NOT EXISTS "ApplicationContactLog_trial_followup_idx"
         ON "ApplicationContactLog" ("trialLeadId", "nextFollowUpAt")
         WHERE "targetType" = 'TRIAL'
           AND "nextFollowUpAt" IS NOT NULL
           AND "followUpCompletedAt" IS NULL`,
        `CREATE INDEX IF NOT EXISTS "ApplicationContactLog_enroll_followup_idx"
         ON "ApplicationContactLog" ("enrollmentApplicationId", "nextFollowUpAt")
         WHERE "targetType" = 'ENROLL'
           AND "nextFollowUpAt" IS NOT NULL
           AND "followUpCompletedAt" IS NULL`,
    ];

    for (const sql of indexes) {
        await prisma.$executeRawUnsafe(sql);
    }

    await prisma.$executeRawUnsafe(`ALTER TABLE "ApplicationContactLog" ENABLE ROW LEVEL SECURITY`);

    _applicationContactLogEnsured = true;
}
