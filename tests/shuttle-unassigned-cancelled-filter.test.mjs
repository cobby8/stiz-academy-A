import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/shuttle/service.ts", import.meta.url), "utf8");

// 관리자 셔틀 화면의 "미배정 학생" 목록 쿼리 본문만 잘라낸다.
const unassignedQuery = source.slice(
    source.indexOf("prisma.specialProgramShuttleRequest.findMany({"),
    source.indexOf("const unassignedRequests"),
);

test("미배정 셔틀 신청 조회는 취소·거절 상태를 제외한다", () => {
    assert.match(unassignedQuery, /status:\s*\{\s*notIn:\s*CLOSED_SHUTTLE_STATUSES\s*\}/);
    assert.match(unassignedQuery, /application:\s*\{[^}]*status:\s*\{\s*notIn:\s*CLOSED_SHUTTLE_STATUSES\s*\}/);
    assert.match(unassignedQuery, /applicationItem:\s*\{\s*status:\s*\{\s*notIn:\s*CLOSED_SHUTTLE_STATUSES\s*\}\s*\}/);
});

test("제외 목록은 취소·거절 두 가지만 담는다", () => {
    assert.match(source, /const CLOSED_SHUTTLE_STATUSES = \["CANCELLED", "REJECTED"\];/);
});

// 허용 목록(equals/in)으로 좁히면 다른 방향 노선에 배정돼 status가 'ASSIGNED'로 바뀐
// 정상 탑승자까지 목록에서 사라진다. 그 회귀를 막는 검사.
test("상태를 허용 목록 방식으로 좁히지 않는다", () => {
    assert.doesNotMatch(unassignedQuery, /status:\s*"REQUESTED"/);
    assert.doesNotMatch(unassignedQuery, /status:\s*\{\s*in:\s*\[/);
    assert.doesNotMatch(unassignedQuery, /status:\s*\{\s*equals:/);
});

test("시즌 조건과 미배정 조건은 그대로 유지한다", () => {
    assert.match(unassignedQuery, /seasonId:\s*selectedSeasonId/);
    assert.match(unassignedQuery, /routePassengers:\s*\{\s*none:/);
    assert.match(unassignedQuery, /status:\s*\{\s*not:\s*ShuttleRoutePlanStatus\.ARCHIVED\s*\}/);
    assert.match(unassignedQuery, /direction:\s*selectedDirection/);
});
