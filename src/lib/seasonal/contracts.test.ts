import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node's type-stripping runner needs the runtime extension.
import { normalizeSeasonalWeekdays, SeasonalError } from "./contracts.ts";

test("weekdays are normalized to the allowed enum and deduplicated", () => {
  assert.deepEqual(normalizeSeasonalWeekdays(["월요일", "MON", "화"]), ["MON", "TUE"]);
});

test("unknown weekdays are rejected", () => {
  assert.throws(() => normalizeSeasonalWeekdays(["휴일"]), (error) => error instanceof SeasonalError && error.code === "INVALID_WEEKDAY");
});
