import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node's type-stripping runner needs the runtime extension.
import { planApplicationItems, totalSnapshot } from "./planning.ts";

test("server prices are copied to immutable application snapshots", () => {
  const plans = planApplicationItems(
    [{ id: "camp-a", capacity: 10, price: 120000, title: "슈팅 특강" }],
    new Map(),
    new Map(),
  );
  assert.equal(plans[0].priceSnapshot, 120000);
  assert.equal(totalSnapshot(plans), 120000);
});

test("a full offering is waitlisted with the next stable order", () => {
  const plans = planApplicationItems(
    [{ id: "camp-a", capacity: 1, price: 50000, title: "드리블 특강" }],
    new Map([["camp-a", 1]]),
    new Map([["camp-a", 4]]),
  );
  assert.equal(plans[0].status, "WAITLISTED");
  assert.equal(plans[0].waitlistOrder, 5);
});

test("remaining capacity accepts an application before the limit", () => {
  const plans = planApplicationItems(
    [{ id: "camp-a", capacity: 2, price: 50000, title: "드리블 특강" }],
    new Map([["camp-a", 1]]),
    new Map(),
  );
  assert.equal(plans[0].status, "PENDING");
  assert.equal(plans[0].waitlistOrder, null);
});

