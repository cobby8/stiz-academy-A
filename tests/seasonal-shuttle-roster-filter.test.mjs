import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 방학특강 셔틀 통합 명단이 "태우면 안 되는 학생"을 다시 끌어오지 않도록 막는 회귀 테스트.
// 실제 사고: WHERE 절이 통째로 없어서 신청 취소자·개설 취소된 반 학생이 기사님 명단에 실렸다.

const roster = readFileSync(new URL("../src/lib/seasonal/shuttle-roster.ts", import.meta.url), "utf8");
const shared = readFileSync(new URL("../src/lib/seasonal/shuttleEligibility.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/app/admin/seasonal/shuttle/ShuttleRosterClient.tsx", import.meta.url), "utf8");
const optimize = readFileSync(new URL("../src/lib/seasonal/shuttle-optimize.ts", import.meta.url), "utf8");

// 조회 쿼리 본문만 잘라낸다.
const rosterQuery = roster.slice(
    roster.indexOf(`SELECT r.id AS "requestId"`),
    roster.indexOf("return rows.map"),
);

test("명단 조회에 WHERE 절이 존재한다", () => {
    assert.match(rosterQuery, /WHERE /);
});

test("취소·거절된 신청서는 명단에서 제외한다", () => {
    assert.match(rosterQuery, /seasonalShuttleEligibilitySql\(\{ application: "a", item: "it", offering: "o" \}\)/);
    assert.match(shared, /\$\{a\}\.status NOT IN \(\$\{closed\}\)/);
});

test("취소된 수강 항목과 개설 취소된 반을 제외한다", () => {
    assert.match(shared, /\$\{it\}\.status NOT IN \(\$\{closed\}\)/);
    assert.match(shared, /\$\{o\}\.status <> '\$\{CANCELLED_OFFERING_STATUS\}'/);
});

// LEFT JOIN 자리에 IS NULL 가드가 빠지면, 조인이 비어 있는 정상 행이 통째로 사라진다.
// "정상 탑승자가 사라지는 것"이 취소자가 남는 것보다 더 큰 사고다.
test("LEFT JOIN 컬럼에는 IS NULL 가드를 함께 건다", () => {
    assert.match(shared, /\(\$\{it\}\.id IS NULL OR /);
    assert.match(shared, /\(\$\{o\}\.id IS NULL OR /);
});

test("명단은 시즌 범위로 좁힌다", () => {
    assert.match(rosterQuery, /WHERE \$\{seasonWhere\}/);
    assert.match(roster, /seasonWhere = `a\."seasonId" = \$1`/);
    // 시즌을 안 넘겼을 때도 보관(ARCHIVED) 시즌은 제외한다.
    assert.match(roster, /seasonWhere = `s\.status <> 'ARCHIVED'`/);
});

// 셔틀 상태(r.status)까지 SQL에서 거르면 '미탑승 → 다시 탑승' 되돌리기가 불가능해진다.
test("셔틀 신청 상태(미탑승)는 SQL에서 거르지 않는다", () => {
    // WHERE ~ ORDER BY 사이(=필터 구간)에는 r.status가 등장하면 안 된다.
    // ORDER BY 쪽의 r.status는 정렬용이라 무관하다.
    const whereClause = rosterQuery.slice(
        rosterQuery.indexOf("WHERE ${seasonWhere}"),
        rosterQuery.indexOf("ORDER BY"),
    );
    assert.ok(whereClause.length > 0);
    assert.doesNotMatch(whereClause, /r\.status/);
});

test("탑승 판정은 REJECTED도 미탑승으로 본다", () => {
    assert.match(roster, /ride: isRidingShuttleStatus\(r\.status\)/);
    assert.doesNotMatch(roster, /ride: r\.status !== "CANCELLED"/);
    assert.match(shared, /return !CLOSED_SHUTTLE_STATUSES\.includes\(String\(status\)\)/);
});

// --- 화면/CSV ---

test("미탑승 학생은 기본으로 숨기고 토글로만 보여준다", () => {
    assert.match(client, /useState\(false\)/);
    assert.match(client, /showNonRiders \? searched : searched\.filter\(\(r\) => r\.ride\)/);
    assert.match(client, /미탑승 \{nonRiderCount\}명 보기/);
});

test("표는 전체 목록이 아니라 걸러진 목록을 그린다", () => {
    assert.match(client, /\{visible\.map\(\(r\) => \(/);
    assert.doesNotMatch(client, /\{rows\.map\(\(r\) => \(/);
});

// 기사님용 CSV에 미탑승자·취소자가 들어가면 실제로 태우면 안 되는 학생을 태우게 된다.
test("CSV는 탑승 학생만 내보낸다", () => {
    assert.match(client, /const exportRows = useMemo\(\(\) => searched\.filter\(\(r\) => r\.ride\), \[searched\]\)/);
    assert.match(client, /for \(const r of exportRows\)/);
    assert.doesNotMatch(client, /for \(const r of rows\)/);
});

test("CSV 파일명에 탑승자 명단임이 드러난다", () => {
    assert.match(client, /방학특강_셔틀_탑승자명단_/);
});

// --- 자동 배차 ---

test("자동 배차는 명단의 탑승자만 쓴다", () => {
    assert.match(optimize, /getSeasonalShuttleRoster\(\)\)\.filter\(\(r\) => r\.ride\)/);
});

test("하원 기준 종료시각은 가장 늦게 끝나는 반을 쓴다", () => {
    assert.doesNotMatch(optimize, /pool\.find\(\(r\) => r\.classEnd\)\?\.classEnd/);
    assert.match(optimize, /const classEnd = pool\.reduce<string \| null>\(/);
});
