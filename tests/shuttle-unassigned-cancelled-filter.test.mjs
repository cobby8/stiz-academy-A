import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 관리자 셔틀 화면 "미배정 학생" 목록의 회귀 테스트.
//
// 구조가 바뀌었다: 예전에는 이 화면이 원본 테이블을 직접 findMany 하면서 제외 조건을 손으로 적었고,
// 그러다 조건이 빠지는 사고가 반복됐다(2026-07-26 기준 6회). 이제 대상자 판정은
// 게이트웨이(shuttleRoster.ts)가 전담하고, 이 화면은 "이미 배정된 사람 빼기"만 한다.
// 그래서 검사도 두 갈래다: ① 화면이 원본을 직접 안 본다 ② 게이트웨이가 조건을 다 건다.

const source = readFileSync(new URL("../src/lib/shuttle/service.ts", import.meta.url), "utf8");
const shared = readFileSync(new URL("../src/lib/seasonal/shuttleEligibility.ts", import.meta.url), "utf8");
const gateway = readFileSync(new URL("../src/lib/seasonal/shuttleRoster.ts", import.meta.url), "utf8");

test("노선 화면은 셔틀 대상자를 원본에서 직접 찾지 않는다", () => {
    assert.doesNotMatch(source, /prisma\.specialProgramShuttleRequest\.findMany/);
    assert.match(source, /import \{ getConfirmedShuttleRoster \} from "@\/lib\/seasonal\/shuttleRoster"/);
    assert.match(source, /getConfirmedShuttleRoster\(selectedSeasonId\)/);
});

// 기준값은 공용 모듈에만 존재해야 한다. 화면마다 따로 정의하던 것이 이번 사고의 근본 원인이었다.
test("제외 목록은 취소·거절 두 가지만 담는다", () => {
    assert.match(shared, /export const CLOSED_SHUTTLE_STATUSES = \["CANCELLED", "REJECTED"\];/);
});

test("노선 화면은 제외 목록을 직접 정의하지 않는다", () => {
    assert.doesNotMatch(source, /const CLOSED_SHUTTLE_STATUSES = \[/);
    assert.doesNotMatch(source, /\["CANCELLED", ?"REJECTED"\]/);
});

// 게이트웨이 폴백이 취소자·취소 항목·폐강 반을 전부 거르는지(예전 조건과 같은지).
test("게이트웨이 폴백이 취소·거절·폐강 반을 모두 제외한다", () => {
    assert.match(gateway, /seasonalShuttleEligibilitySql\(\{ application: "a", item: "it", offering: "o" \}\)/);
    assert.match(shared, /\$\{a\}\.status NOT IN \(\$\{closed\}\)/);
    assert.match(shared, /\$\{it\}\.status NOT IN \(\$\{closed\}\)/);
    assert.match(shared, /\$\{o\}\.status <> '\$\{CANCELLED_OFFERING_STATUS\}'/);
});

// 허용 목록(equals/in)으로 좁히면 다른 방향 노선에 배정돼 status가 'ASSIGNED'로 바뀐
// 정상 탑승자까지 목록에서 사라진다. 그 회귀를 막는 검사.
test("상태를 허용 목록 방식으로 좁히지 않는다", () => {
    assert.doesNotMatch(gateway, /status:\s*"REQUESTED"/);
    assert.doesNotMatch(gateway, /r\.status\s*=\s*'REQUESTED'/);
    assert.doesNotMatch(gateway, /r\.status IN \(/);
});

// 미배정 판정(= 이미 노선에 태워 뒀는가)은 그대로 남아야 한다.
test("시즌 조건과 미배정 조건은 그대로 유지한다", () => {
    assert.match(source, /prisma\.shuttleRoutePassenger\.findMany\(/);
    assert.match(source, /status:\s*\{\s*not:\s*ShuttleRoutePlanStatus\.ARCHIVED\s*\}/);
    assert.match(source, /direction:\s*selectedDirection/);
    assert.match(source, /hasServiceDate \? \{ serviceDate: selectedServiceDate \} : \{\}/);
    assert.match(source, /!assignedIds\.has\(entry\.shuttleRequestId\)/);
});

// 미탑승(ride=false)으로 눌러 둔 학생은 노선 편성 후보가 아니다.
test("미탑승 학생은 미배정 후보에서 제외한다", () => {
    assert.match(source, /entry\.ride && !assignedIds\.has/);
});

// 노선 편성 화면은 "관리자 위치 확인 시각"이 있어야 배차 버튼이 열린다(canAssign 조건).
// 확정 명단에 이 값을 복제해 두지 않으면 전원이 배차 불가가 된다.
test("위치 확인 시각(confirmedAt)을 명단에서 잃어버리지 않는다", () => {
    assert.match(source, /confirmedAt: entry\.pickup\.confirmedAt/);
    assert.match(source, /confirmedAt: entry\.dropoff\.confirmedAt/);
    assert.match(gateway, /confirmedAt: dt\(p\("ConfirmedAt"\)\)/);
    assert.match(gateway, /"pickupConfirmedAt"/);
    assert.match(gateway, /"dropoffConfirmedAt"/);
});
