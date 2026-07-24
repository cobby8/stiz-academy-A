import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node's type-stripping runner needs the runtime extension.
import { decideApplicantType, hasSeasonalShuttleSelection, planApplicationItems, resolveOfferingPrice, resolveShuttleFee, totalSnapshot, weekdayInSeoul } from "./planning.ts";

test("server prices are copied to immutable application snapshots", () => {
  const plans = planApplicationItems(
    [{ id: "camp-a", capacity: 10, price: 120000, title: "슈팅 특강" }],
    new Map(),
    new Map(),
  );
  assert.equal(plans[0].priceSnapshot, 120000);
  assert.equal(plans[0].tuitionPriceSnapshot, 120000);
  assert.equal(plans[0].shuttleFeeSnapshot, 0);
  assert.equal(totalSnapshot(plans), 120000);
});

test("shuttle fee is charged once per selected offering and preserved separately", () => {
  const offering = {
    id: "camp-a",
    capacity: 10,
    price: 150000,
    shuttleAvailable: true,
    shuttleFee: 15000,
    title: "특강",
  };
  assert.equal(resolveShuttleFee(offering, true), 15000);
  const plan = planApplicationItems(
    [offering],
    new Map(),
    new Map(),
    "EXISTING",
    new Set(["camp-a"]),
  )[0];
  assert.equal(plan.tuitionPriceSnapshot, 150000);
  assert.equal(plan.shuttleFeeSnapshot, 15000);
  assert.equal(plan.priceSnapshot, 165000);
});

test("shuttle fee is not charged when shuttle is unavailable or not selected", () => {
  assert.equal(resolveShuttleFee({ id: "a", capacity: 10, price: 1, shuttleAvailable: false, shuttleFee: 15000, title: "A" }, true), 0);
  assert.equal(resolveShuttleFee({ id: "b", capacity: 10, price: 1, shuttleAvailable: true, shuttleFee: 15000, title: "B" }, false), 0);
});

test("an empty shuttle payload is not treated as a shuttle selection", () => {
  assert.equal(hasSeasonalShuttleSelection(undefined), false);
  assert.equal(hasSeasonalShuttleSelection({}), false);
  assert.equal(hasSeasonalShuttleSelection({ pickupTime: "09:00" }), false);
  assert.equal(hasSeasonalShuttleSelection({ pickupLocation: "다산역" }), true);
  assert.equal(hasSeasonalShuttleSelection({ dropoffLocationData: { address: "학교 앞" } }), true);
});

test("repeating the same price plan produces the same idempotent snapshot", () => {
  const offering = {
    id: "camp-a",
    capacity: 10,
    price: 180000,
    shuttleAvailable: true,
    shuttleFee: 15000,
    title: "특강",
  };
  const first = planApplicationItems([offering], new Map(), new Map(), "NEW", new Set(["camp-a"]));
  const retry = planApplicationItems([offering], new Map(), new Map(), "NEW", new Set(["camp-a"]));
  assert.deepEqual(first, retry);
});

test("applicant-specific prices are selected on the server and preserved in the snapshot", () => {
  const offering = {
    id: "camp-a",
    capacity: 10,
    price: 200000,
    newApplicantPrice: 180000,
    existingApplicantPrice: 150000,
    title: "여름 특강",
  };
  assert.equal(resolveOfferingPrice(offering, "NEW"), 180000);
  assert.equal(resolveOfferingPrice(offering, "EXISTING"), 150000);
  assert.equal(planApplicationItems([offering], new Map(), new Map(), "EXISTING")[0].priceSnapshot, 150000);
});

test("the base price remains compatible when applicant type is not supplied", () => {
  assert.equal(resolveOfferingPrice({ id: "camp-a", capacity: 10, price: 200000, title: "특강" }), 200000);
});

test("an unverified existing-member claim is reviewed and charged the safe new-member price", () => {
  assert.deepEqual(decideApplicantType("EXISTING", false), {
    serverType: "NEW",
    pricingType: "NEW",
    requiresReview: true,
    reviewReasons: ["APPLICANT_TYPE_MISMATCH"],
  });
});

test("a server-verified existing student receives the existing-member price", () => {
  assert.deepEqual(decideApplicantType("EXISTING", true), {
    serverType: "EXISTING",
    pricingType: "EXISTING",
    requiresReview: false,
    reviewReasons: [],
  });
});

test("session weekdays are resolved in Korea time around the UTC date boundary", () => {
  assert.equal(weekdayInSeoul(new Date("2026-07-27T00:30:00+09:00")), "MON");
  assert.equal(weekdayInSeoul(new Date("2026-07-26T15:30:00Z")), "MON");
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

test("an unspecified capacity offering accepts an application without waitlisting", () => {
  const plans = planApplicationItems(
    [{ id: "camp-a", capacity: null, price: 50000, title: "여름 특강" }],
    new Map([["camp-a", 99]]),
    new Map([["camp-a", 4]]),
  );
  assert.equal(plans[0].status, "PENDING");
  assert.equal(plans[0].waitlistOrder, null);
});
