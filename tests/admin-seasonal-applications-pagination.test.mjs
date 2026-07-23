import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const seasonalRoute = readFileSync(new URL("../src/app/api/admin/seasonal/route.ts", import.meta.url), "utf8");
const seasonalClient = readFileSync(new URL("../src/app/admin/seasonal/SeasonalAdminClient.tsx", import.meta.url), "utf8");

test("seasonal admin applications are loaded with server pagination", () => {
  assert.match(seasonalRoute, /seasonalApplicationWhere/);
  assert.match(seasonalRoute, /pageSize = rosterInt\(request\.nextUrl\.searchParams\.get\("pageSize"\), 30, 1, 100\)/);
  assert.match(seasonalRoute, /prisma\.specialProgramApplication\.findMany\(\{/);
  assert.match(seasonalRoute, /skip: offset/);
  assert.match(seasonalRoute, /take: pageSize/);
  assert.match(seasonalRoute, /applicationsPagination/);
});

test("seasonal admin seasons no longer include every application row", () => {
  const includeApplicationsStart = seasonalRoute.indexOf("const [seasons, stats, applicationRows, totalApplications]");
  const includeApplicationsEnd = seasonalRoute.indexOf("const paymentIds", includeApplicationsStart);
  const includeBlock = seasonalRoute.slice(includeApplicationsStart, includeApplicationsEnd);
  assert.doesNotMatch(includeBlock, /applications:\s*\{/);
});

test("seasonal admin client sends filters to the server and renders page controls", () => {
  assert.match(seasonalClient, /applicationsPagination/);
  assert.match(seasonalClient, /params\.set\("includeApplications", "true"\)/);
  assert.match(seasonalClient, /params\.set\("page", String\(requestedPage\)\)/);
  assert.match(seasonalClient, /params\.set\("q", nextSearch\.trim\(\)\)/);
  assert.match(seasonalClient, /params\.set\("status", nextStatus\)/);
  assert.match(seasonalClient, /onPage\(pagination\.page \+ 1\)/);
});
