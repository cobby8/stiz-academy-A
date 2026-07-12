-- Admin performance indexes
-- Purpose: keep frequently used admin lists fast as data grows.
-- Apply through `npm run db:push` or Supabase SQL Editor.

CREATE INDEX IF NOT EXISTS "Enrollment_createdAt_idx"
    ON "Enrollment" ("createdAt");

CREATE INDEX IF NOT EXISTS "Enrollment_status_updatedAt_idx"
    ON "Enrollment" (status, "updatedAt");

CREATE INDEX IF NOT EXISTS "Payment_dueDate_idx"
    ON "Payment" ("dueDate");

CREATE INDEX IF NOT EXISTS "Payment_status_dueDate_idx"
    ON "Payment" (status, "dueDate");

CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx"
    ON "Notification" ("userId", "isRead", "createdAt");

DROP INDEX IF EXISTS "Notification_userId_isRead_idx";

CREATE INDEX IF NOT EXISTS "Feedback_createdAt_idx"
    ON "Feedback" ("createdAt");

CREATE INDEX IF NOT EXISTS "TrialLead_status_createdAt_idx"
    ON "TrialLead" (status, "createdAt");

CREATE INDEX IF NOT EXISTS "Waitlist_classId_priority_createdAt_idx"
    ON "Waitlist" ("classId", priority, "createdAt");

CREATE INDEX IF NOT EXISTS "MakeupSession_createdAt_idx"
    ON "MakeupSession" ("createdAt");

CREATE INDEX IF NOT EXISTS "MakeupSession_status_createdAt_idx"
    ON "MakeupSession" (status, "createdAt");
