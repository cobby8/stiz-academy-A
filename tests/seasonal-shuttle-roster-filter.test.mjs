import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 방학특강 셔틀 명단이 "태우면 안 되는 학생"을 다시 끌어오지 않도록 막는 회귀 테스트.
// 실제 사고: WHERE 절이 통째로 없어서 신청 취소자·개설 취소된 반 학생이 기사님 명단에 실렸다.
//
// 구조 변경(0~2단계): 대상자 판정은 이제 게이트웨이(shuttleRoster.ts) 한 곳에만 있다.
// 화면 파일들은 게이트웨이를 부르기만 하므로, 조건 검사는 게이트웨이를 상대로 한다.

const roster = readFileSync(new URL("../src/lib/seasonal/shuttle-roster.ts", import.meta.url), "utf8");
const shared = readFileSync(new URL("../src/lib/seasonal/shuttleEligibility.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/app/admin/seasonal/shuttle/ShuttleRosterClient.tsx", import.meta.url), "utf8");
const optimize = readFileSync(new URL("../src/lib/seasonal/shuttle-optimize.ts", import.meta.url), "utf8");
const gateway = readFileSync(new URL("../src/lib/seasonal/shuttleRoster.ts", import.meta.url), "utf8");

// 게이트웨이의 폴백(원본 조회) 쿼리 본문만 잘라낸다.
const fallbackQuery = gateway.slice(
    gateway.indexOf("async function fallbackSeasonRoster"),
    gateway.indexOf("// 노출 함수 2"),
);

test("명단 조회에 WHERE 절이 존재한다", () => {
    assert.match(fallbackQuery, /WHERE /);
});

test("화면 파일은 대상자를 직접 조회하지 않는다", () => {
    // 통합 명단·자동 배차 모두 원본 신청 테이블을 SELECT 해서는 안 된다.
    assert.doesNotMatch(roster, /FROM "SpecialProgramShuttleRequest" r\b/);
    assert.doesNotMatch(optimize, /FROM "SpecialProgramEnrollmentDate"/);
    assert.match(roster, /import \{ getConfirmedShuttleRoster \} from "\.\/shuttleRoster"/);
    assert.match(optimize, /import \{ getConfirmedShuttleRosterForDate \} from "\.\/shuttleRoster"/);
});

test("취소·거절된 신청서는 명단에서 제외한다", () => {
    assert.match(fallbackQuery, /seasonalShuttleEligibilitySql\(\{ application: "a", item: "it", offering: "o" \}\)/);
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
    assert.match(fallbackQuery, /WHERE \$\{scope\.where\}/);
    assert.match(gateway, /return \{ where: `\$\{col\} = \$1`, params \}/);
    // 시즌을 안 넘겼을 때도 보관(ARCHIVED) 시즌은 제외한다.
    assert.match(gateway, /status <> 'ARCHIVED'/);
});

// 셔틀 상태(r.status)까지 SQL에서 거르면 '미탑승 → 다시 탑승' 되돌리기가 불가능해진다.
test("셔틀 신청 상태(미탑승)는 SQL에서 거르지 않는다", () => {
    // 폴백 쿼리의 WHERE 구간에는 r.status 비교가 등장하면 안 된다(SELECT의 ride 계산은 무관).
    const whereClause = fallbackQuery.slice(
        fallbackQuery.indexOf("WHERE ${scope.where}"),
        fallbackQuery.indexOf(") t"),
    );
    assert.ok(whereClause.length > 0);
    assert.doesNotMatch(whereClause, /r\.status/);
});

test("탑승 판정은 REJECTED도 미탑승으로 본다", () => {
    assert.match(gateway, /ride: isRidingShuttleStatus\(r\.requestStatus\)/);
    assert.doesNotMatch(gateway, /ride: r\.status !== "CANCELLED"/);
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
    // 표를 여러 묶음(예: 1호점 무료탑승 폴더)으로 나눠 그리더라도, 그리는 원천은 반드시
    // 걸러진 목록(visible)에서 파생돼야 한다. rows를 직접 그리면 미탑승자가 표에 되살아난다.
    // 그리는 방식(인라인 JSX든 renderRow 헬퍼든)은 자유지만, 원천 목록은 고정이다.
    const rendered = [...client.matchAll(/\{(?:\w+ && )?(\w+)\.map\((?:\(r\) => \(|renderRow\))/g)].map((m) => m[1]);
    assert.ok(rendered.length > 0, "표를 그리는 map을 찾지 못했다");
    assert.ok(!rendered.includes("rows"), "걸러지지 않은 rows를 직접 그리고 있다");
    for (const name of new Set(rendered)) {
        if (name === "visible") continue;
        // visible이 아니면 visible에서 파생된 목록이어야 한다.
        assert.match(
            client,
            new RegExp(`const ${name} = useMemo\\(\\(\\) => visible`),
            `${name} 이 걸러진 목록(visible)에서 나오지 않는다`,
        );
    }
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

// 자동 배차는 날짜별 좌석(SpecialProgramEnrollmentDate)에서 뽑는데, 조회를 새로 짤 때마다
// 필터가 빠지는 사고가 반복됐다(5회). 그래서 이제 배차 파일에는 대상자 쿼리를 아예 두지 않는다.
test("자동 배차 대상자는 게이트웨이를 통해서만 가져온다", () => {
    assert.match(optimize, /import \{ getConfirmedShuttleRosterForDate \} from "\.\/shuttleRoster"/);
    assert.match(optimize, /getConfirmedShuttleRosterForDate\(opts\.date \?\? null, direction\)/);
    // 원본 신청 테이블을 직접 조인하면 안 된다.
    assert.doesNotMatch(optimize, /"SpecialProgramShuttleRequest"/);
    assert.doesNotMatch(optimize, /"SpecialProgramApplication"/);
});

// 셔틀 상태를 `<> 'CANCELLED'`로만 보면 REJECTED가 탑승자로 샌다(과거 실제 사고).
test("자동 배차는 셔틀 상태를 손으로 비교하지 않는다", () => {
    assert.doesNotMatch(optimize, /r\.status <> 'CANCELLED'/);
    assert.doesNotMatch(gateway, /status <> 'CANCELLED'/);
    // 상태 비교는 공용 헬퍼가 만들어 준다.
    assert.match(shared, /export function ridingShuttleStatusSql/);
    assert.match(gateway, /ridingShuttleStatusSql\("r"\)/);
});

// 통합 명단은 미탑승 되돌리기를 위해 r.status를 SQL에서 거르면 안 된다.
// 그래서 공용 조각의 셔틀 조건은 '선택'이어야 하고, 명단 폴백은 그 인자를 주면 안 된다.
test("셔틀 상태 조건은 선택 인자이고 통합 명단은 쓰지 않는다", () => {
    assert.match(shared, /shuttleRequest\?: string;/);
    assert.doesNotMatch(fallbackQuery, /shuttleRequest/);
});

test("하원 기준 종료시각은 가장 늦게 끝나는 반을 쓴다", () => {
    assert.doesNotMatch(gateway, /classEnd: riders\[0\]/);
    assert.match(gateway, /const classEnd = riders\.reduce<string \| null>\(/);
    // 등원은 반대로 가장 먼저 시작하는 반 기준이어야 지각이 안 난다.
    assert.match(gateway, /const classStart = riders\.reduce<string \| null>\(/);
});

// 날짜별 배차인데 날짜 조건이 빠지면 다른 요일 학생까지 한 차에 실린다.
test("탑승자 조회는 선택한 날짜로 좁힌다", () => {
    assert.match(gateway, /e\.status = 'SCHEDULED'/);
    assert.match(gateway, /String\(seat\.serviceDate\) !== selected/);
});

// 확정 명단은 "시즌 회원"이고, 그날 태울 사람은 좌석으로 파생한다.
// 그날 수업이 취소되면 그날 노선에서만 빠지고 시즌 명단에는 남아야 한다.
test("날짜별 명단은 확정본 × 그날 좌석으로 파생한다", () => {
    assert.match(gateway, /const roster = await getConfirmedShuttleRoster\(\)/);
    assert.match(gateway, /roster\.filter\(\(row\) => row\.ride\)/);
    assert.match(gateway, /"SpecialProgramEnrollmentDate" e/);
    // 날짜별 확정 테이블을 새로 만들지 않았는지(운영 불가한 구조)
    assert.doesNotMatch(gateway, /SeasonalShuttleRosterDate/);
});
