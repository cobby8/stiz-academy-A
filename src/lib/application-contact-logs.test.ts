import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node's built-in test runner loads TypeScript source directly.
import { APPLICATION_CONTACT_ACTIONS, APPLICATION_CONTACT_ACTION_CONSTRAINT_SQL } from "./application-contact-actions.ts";

test("application history actions stay aligned with the database constraint", () => {
    assert.deepEqual(APPLICATION_CONTACT_ACTIONS, [
        "CONTACTED",
        "NO_ANSWER",
        "FOLLOW_UP",
        "MEMO",
        "UPDATED",
        "SCHEDULED",
        "CANCELLED",
    ]);

    for (const action of APPLICATION_CONTACT_ACTIONS) {
        assert.match(APPLICATION_CONTACT_ACTION_CONSTRAINT_SQL, new RegExp(`'${action}'`));
    }
});

test("constraint replacement is idempotent for an existing database", () => {
    assert.match(
        APPLICATION_CONTACT_ACTION_CONSTRAINT_SQL,
        /DROP CONSTRAINT IF EXISTS "ApplicationContactLog_action_check"/,
    );
    assert.match(
        APPLICATION_CONTACT_ACTION_CONSTRAINT_SQL,
        /ADD CONSTRAINT "ApplicationContactLog_action_check"/,
    );
});
