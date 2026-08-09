import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// 순수 계산 모듈은 의존성이 없으므로 실제로 실행해서 검증한다.
const diffSource = readFileSync("src/lib/seasonal/enrollment-dates-diff.ts", "utf8");
const transpiled = ts.transpileModule(diffSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { diffEnrollmentDates } = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`
);

const lib = readFileSync("src/lib/seasonal/enrollment-dates.ts", "utf8");
const makeup = readFileSync("src/lib/seasonal/makeup.ts", "utf8");
const capacity = readFileSync("src/lib/seasonal/makeup-capacity.ts", "utf8");
const route = readFileSync("src/app/api/admin/seasonal/route.ts", "utf8");
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");

const slot = (sessionDateId, overrides = {}) => ({
  sessionDateId,
  kind: "REGULAR",
  status: "SCHEDULED",
  attendanceStatus: null,
  ...overrides,
});

/* ---------------- 순수 함수: diffEnrollmentDates ---------------- */

test("목표 날짜에 좌석이 없으면 새로 만든다", () => {
  const diff = diffEnrollmentDates([], ["d1", "d2"]);
  assert.deepEqual(diff.toInsert, ["d1", "d2"]);
  assert.deepEqual(diff.toCancel, []);
  assert.deepEqual(diff.toRevive, []);
  assert.deepEqual(diff.blockedByAttendance, []);
});

test("목표에서 빠진 정규 좌석은 소프트 취소 대상이 된다", () => {
  const diff = diffEnrollmentDates([slot("old1"), slot("keep")], ["keep", "new1"]);
  assert.deepEqual(diff.toCancel, ["old1"]);
  assert.deepEqual(diff.toInsert, ["new1"]);
});

test("출결이 찍힌 좌석은 목표에서 빠져도 취소하지 않고 보고만 한다", () => {
  const diff = diffEnrollmentDates(
    [slot("done", { attendanceStatus: "PRESENT" }), slot("absent", { attendanceStatus: "ABSENT" }), slot("plain")],
    [],
  );
  assert.deepEqual(diff.toCancel, ["plain"]);
  assert.deepEqual(diff.blockedByAttendance, ["done", "absent"]);
});

test("되돌아온 반의 취소 좌석은 되살린다", () => {
  const diff = diffEnrollmentDates([slot("back", { status: "CANCELLED" })], ["back"]);
  assert.deepEqual(diff.toRevive, ["back"]);
  assert.deepEqual(diff.toInsert, [], "이미 행이 있으므로 새로 넣지 않는다");
});

test("출결이 찍힌 취소 좌석은 되살리지 않는다", () => {
  const diff = diffEnrollmentDates([slot("frozen", { status: "CANCELLED", attendanceStatus: "ABSENT" })], ["frozen"]);
  assert.deepEqual(diff.toRevive, []);
  assert.deepEqual(diff.toInsert, []);
});

test("보강 좌석은 재동기화 대상이 아니다", () => {
  const diff = diffEnrollmentDates([slot("mk", { kind: "MAKEUP" })], []);
  assert.deepEqual(diff.toCancel, []);
  assert.deepEqual(diff.blockedByAttendance, []);
});

test("보강 좌석이 있는 날짜에는 정규 좌석을 새로 끼워넣지 않는다", () => {
  const diff = diffEnrollmentDates([slot("shared", { kind: "MAKEUP" })], ["shared"]);
  assert.deepEqual(diff.toInsert, [], "유니크키 충돌을 만들면 안 된다");
});

test("같은 계산을 두 번 해도 결과가 같다(멱등)", () => {
  const target = ["keep", "back", "new"];
  const first = diffEnrollmentDates([slot("keep"), slot("old"), slot("back", { status: "CANCELLED" })], target);
  assert.deepEqual(first.toInsert, ["new"]);
  assert.deepEqual(first.toCancel, ["old"]);
  assert.deepEqual(first.toRevive, ["back"]);
  // 1회차 실행 결과를 DB에 반영한 뒤의 상태
  const afterFirst = [slot("keep"), slot("old", { status: "CANCELLED" }), slot("back"), slot("new")];
  const second = diffEnrollmentDates(afterFirst, target);
  assert.deepEqual(second.toInsert, [], "두 번째 실행에서는 더 할 일이 없어야 한다");
  assert.deepEqual(second.toCancel, []);
  assert.deepEqual(second.toRevive, []);
});

/* ---------------- 재동기화 SQL 안전장치 ---------------- */

test("재동기화는 신청서 단위로 승인 항목 전체를 처리한다", () => {
  assert.match(lib, /export async function resyncEnrollmentDatesForApplication\(applicationId: string\)/);
  assert.match(lib, /WHERE it\."applicationId" = \$1\s*\n\s*AND it\.status = 'APPROVED'/);
});

test("거두기·되살리기 UPDATE 는 출결 없는 정규 좌석만 건드린다", () => {
  const code = stripComments(lib);
  const updates = code.match(/UPDATE "SpecialProgramEnrollmentDate"[\s\S]*?`/g) ?? [];
  // 개수를 못박지 않는다. 안전한 UPDATE 가 하나 늘었다고 실패하면(실제로 늘었다),
  // 정작 지켜야 할 "모든 UPDATE 가 안전장치를 갖췄는가"를 아무도 안 보게 된다.
  assert.ok(updates.length >= 2, `거두기·되살리기 UPDATE 를 찾지 못했습니다(${updates.length}개)`);
  for (const statement of updates) {
    assert.match(statement, /kind = 'REGULAR'/);
    assert.match(statement, /"attendanceStatus" IS NULL/);
  }
  assert.match(code, /SET status='CANCELLED'/, "거두기는 소프트 취소");
  assert.doesNotMatch(code, /DELETE FROM "SpecialProgramEnrollmentDate"/, "하드 삭제 금지");
});

test("재동기화 실패가 반 이동을 되돌리지 않도록 안전 래퍼를 쓴다", () => {
  assert.match(lib, /export async function resyncEnrollmentDatesForApplicationSafe/);
  assert.match(lib, /console\.error\("\[seasonal enrollment-dates resync\]"/);
});

test("반 이동·항목 추가 경로에서 재동기화를 호출한다", () => {
  assert.match(route, /resyncEnrollmentDatesForApplicationSafe/);
  assert.match(route, /const enrollmentDatesResync = await resyncEnrollmentDatesForApplicationSafe\(result\.item\.applicationId\)/);
});

test("재동기화는 배정 트랜잭션 커밋 이후에 실행한다", () => {
  const transactionBlocks = route.match(/prisma\.\$transaction\([\s\S]{0,600}?\);/g) ?? [];
  for (const block of transactionBlocks) {
    assert.doesNotMatch(block, /resyncEnrollmentDatesForApplicationSafe/);
  }
});

test("출결 때문에 못 거둔 좌석은 감사로그에 남긴다", () => {
  assert.match(route, /enrollmentDatesResync\.blockedByAttendance > 0/);
  assert.match(route, /action: "ITEM_ASSIGNMENT_UPDATED"/);
  assert.match(route, /enrollmentDatesResync: \{/);
});

/* ---------------- 보강 생명주기 안전장치 ---------------- */

test("보강 좌석 upsert 는 취소·출결없음 행만 재사용한다", () => {
  assert.match(makeup, /ON CONFLICT \("applicationItemId","sessionDateId"\) DO UPDATE/);
  assert.match(makeup, /WHERE "SpecialProgramEnrollmentDate"\.status = 'CANCELLED'/);
  assert.match(makeup, /AND "SpecialProgramEnrollmentDate"\."attendanceStatus" IS NULL/);
});

test("보강 좌석을 못 만들면 조용히 넘어가지 않고 에러를 던진다", () => {
  assert.match(makeup, /if \(Number\(affected\) === 0\)/);
  assert.match(makeup, /throw new Error\("TARGET_ALREADY_ENROLLED"\)/);
});

test("저장 경로에도 '그 날 이미 수업 있음' 검사가 있다", () => {
  assert.match(makeup, /async function assertTargetDateFree/);
  assert.match(makeup, /await assertTargetDateFree\(abs\.applicationItemId, \{ sessionDateId: input\.targetSessionDateId \}\)/);
});

test("보강 취소는 보강 좌석 중 출결 없는 것만 취소한다", () => {
  assert.match(
    makeup,
    /WHERE "makeupId"=\$1 AND kind='MAKEUP' AND "attendanceStatus" IS NULL/,
  );
});

test("보강 좌석 생성이 막히면 보강 배정을 되돌린다", () => {
  assert.match(makeup, /UPDATE "SpecialProgramMakeup" SET status='CANCELLED'/);
  assert.doesNotMatch(stripComments(makeup), /DELETE FROM "SpecialProgramMakeup"/);
});

test("보강 정원은 승인과 같은 그룹 × 요일 기준으로 판정한다", () => {
  assert.match(makeup, /loadSeasonalMakeupRooms/);
  assert.match(capacity, /candidate\."seasonId" = \$1 AND candidate\."linkedClassId" = \$2/);
  assert.match(capacity, /item\.status IN \('\$\{MAKEUP_SEAT_ITEM_STATUSES\.join\("','"\)\}'\)/);
});

test("이미 정원을 넘긴 반은 보강을 막지 않고 경고만 남긴다", () => {
  assert.match(capacity, /if \(regularOccupied >= capacity\) \{/);
  assert.match(capacity, /return \{ hasRoom: true, overCapacityBaseline: true, remaining \}/);
  assert.match(makeup, /room\?\.overCapacityBaseline/);
});

test("보강 정원 조회도 승인된 신청 항목만 센다", () => {
  assert.match(capacity, /it\.status = 'APPROVED'/);
});
