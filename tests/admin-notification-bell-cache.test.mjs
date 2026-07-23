import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../src/app/admin/AdminNotificationBell.tsx", import.meta.url), "utf8");

test("admin notification bell reuses recently loaded notifications", () => {
  assert.match(source, /const NOTIFICATION_CACHE_MS = 60_000/);
  assert.match(source, /lastLoadedAtRef = useRef\(0\)/);
  assert.match(source, /lastLoadedAtRef\.current = Date\.now\(\)/);
  assert.match(source, /Date\.now\(\) - lastLoadedAtRef\.current > NOTIFICATION_CACHE_MS/);
});
