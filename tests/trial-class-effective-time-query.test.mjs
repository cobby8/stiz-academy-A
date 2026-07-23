import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const queries = readFileSync(new URL("../src/lib/queries.ts", import.meta.url), "utf8");

test("getClasses preserves the shared Class time contract", () => {
    assert.match(
        queries,
        /c\."startTime", c\."endTime"/,
    );
    assert.match(
        queries,
        /startTime: r\.startTime \?\? r\.starttime \?\? ""/,
    );
    assert.doesNotMatch(queries, /AS "effectiveStartTime"/);
});

test("getClasses exposes override and date-aware schedule candidates separately", () => {
    for (const field of [
        "scheduleStartTime",
        "scheduleEndTime",
        "scheduleActiveFrom",
        "scheduleActiveTo",
        "startTimeOverride",
        "endTimeOverride",
        "customStartTime",
        "customEndTime",
    ]) {
        assert.match(queries, new RegExp(`${field}:`));
    }
});
