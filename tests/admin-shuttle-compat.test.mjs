import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(
    new URL("../src/app/admin/shuttle/page.tsx", import.meta.url),
    "utf8",
);

// 노선 편성은 「자동 배차」로 이전됨 → 이 URL(/admin/shuttle)은 차량 관리 + 섹션 탭을 렌더한다.
// 지키려는 불변식: 이 주소가 실제 화면을 제공하고 리다이렉트/빈 화면으로 퇴화하지 않는다.
test("셔틀 관리자 주소는 실제 화면을 제공한다(리다이렉트 아님)", () => {
    assert.match(route, /import VehicleManagerClient/);
    assert.match(route, /<VehicleManagerClient/);
    assert.match(route, /<ShuttleSectionTabs/);
    assert.doesNotMatch(route, /redirect\(/);
});
