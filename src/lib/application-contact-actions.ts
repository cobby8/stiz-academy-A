export type ApplicationContactAction =
    | "CONTACTED"
    | "NO_ANSWER"
    | "FOLLOW_UP"
    | "MEMO"
    | "UPDATED"
    | "SCHEDULED"
    | "CANCELLED";

export const APPLICATION_CONTACT_ACTIONS = [
    "CONTACTED",
    "NO_ANSWER",
    "FOLLOW_UP",
    "MEMO",
    "UPDATED",
    "SCHEDULED",
    "CANCELLED",
] as const satisfies readonly ApplicationContactAction[];

/** The database constraint is generated from the application contract. */
export const APPLICATION_CONTACT_ACTION_CONSTRAINT_SQL = `
    ALTER TABLE "ApplicationContactLog"
        DROP CONSTRAINT IF EXISTS "ApplicationContactLog_action_check",
        ADD CONSTRAINT "ApplicationContactLog_action_check"
        CHECK (action IN (${APPLICATION_CONTACT_ACTIONS.map((action) => `'${action}'`).join(", ")}))
`;
