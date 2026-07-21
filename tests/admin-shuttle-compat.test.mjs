import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(
    new URL("../src/app/admin/shuttle/page.tsx", import.meta.url),
    "utf8",
);

test("기존 셔틀 관리자 주소는 방학특강 신청 관리 화면으로 연결된다", () => {
    assert.match(route, /redirect\("\/admin\/seasonal\?tab=applications"\)/);
});
