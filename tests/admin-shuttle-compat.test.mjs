import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(
    new URL("../src/app/admin/shuttle/page.tsx", import.meta.url),
    "utf8",
);

test("셔틀 관리자 주소는 실제 노선 관리 화면을 제공한다", () => {
    assert.match(route, /import ShuttleRouteAdminClient/);
    assert.match(route, /<ShuttleRouteAdminClient/);
    assert.doesNotMatch(route, /redirect\(/);
});
