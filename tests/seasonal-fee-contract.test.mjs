import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const service = await readFile(new URL("../src/lib/seasonal/service.ts", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../src/app/api/admin/seasonal/route.ts", import.meta.url), "utf8");

test("public application saves tuition and shuttle fee snapshots with the final total", () => {
  assert.match(service, /tuitionPriceSnapshot:\s*assignment\.priceSnapshot/);
  assert.match(service, /shuttleFeeSnapshot/);
  assert.match(service, /priceSnapshot:\s*assignment\.priceSnapshot \+ shuttleFeeSnapshot/);
  assert.match(service, /hasSeasonalShuttleSelection\(requested\?\.shuttle\)/);
});

test("admin offering writes validate a non-negative configurable shuttle fee", () => {
  assert.match(adminRoute, /shuttleFee:\s*nonNegativeInt\(data\.shuttleFee \?\? 0,\s*"셔틀비"\)/);
  assert.match(adminRoute, /update\.shuttleFee = nonNegativeInt\(data\.shuttleFee,\s*"셔틀비"\)/);
});

test("admin reassignment preserves a valid shuttle request and recomputes the final snapshot", () => {
  assert.match(adminRoute, /include:\s*\{\s*application:\s*true,\s*offering:\s*true,\s*shuttleRequest:\s*true\s*\}/);
  assert.match(adminRoute, /priceSnapshot:\s*assignment\.priceSnapshot \+ specialProgramShuttleFee\(offering,\s*Boolean\(before\.shuttleRequest\)\)/);
});
