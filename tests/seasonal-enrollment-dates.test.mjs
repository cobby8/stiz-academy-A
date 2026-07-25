import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const lib = readFileSync("src/lib/seasonal/enrollment-dates.ts", "utf8");
const route = readFileSync("src/app/api/admin/seasonal/route.ts", "utf8");
// 주석에 설명용으로 적힌 문구가 금지 패턴 검사에 걸리지 않도록 실행 코드만 남긴다.
const libCode = lib.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");

test("정규 수강일 슬롯은 kind='REGULAR' 로 삽입한다", () => {
  assert.match(lib, /INSERT INTO "SpecialProgramEnrollmentDate"/);
  assert.match(lib, /"applicationItemId","offeringId","sessionDateId","studentId","kind","status"/);
  assert.match(lib, /'REGULAR','SCHEDULED'/);
});

test("보강 슬롯을 덮어쓰지 않도록 ON CONFLICT DO NOTHING 만 사용한다", () => {
  assert.match(lib, /ON CONFLICT \("applicationItemId","sessionDateId"\) DO NOTHING/);
  assert.doesNotMatch(libCode, /DO UPDATE/);
});

test("수강일 행은 절대 하드 삭제하지 않는다", () => {
  assert.doesNotMatch(libCode, /DELETE FROM "SpecialProgramEnrollmentDate"/);
});

test("수강일 행 UPDATE 는 정규 좌석 + 출결 없음 조건에서만 허용한다", () => {
  // 재동기화(resync)가 생기면서 UPDATE 가 필요해졌다. 다만 출결이 찍힌 행은 SQL 단계에서 제외돼야 한다.
  const updates = libCode.match(/UPDATE "SpecialProgramEnrollmentDate"[\s\S]*?`/g) ?? [];
  assert.ok(updates.length > 0, "재동기화 UPDATE 문이 있어야 한다");
  for (const statement of updates) {
    assert.match(statement, /kind = 'REGULAR'/, "정규 좌석만 건드려야 한다");
    assert.match(statement, /"attendanceStatus" IS NULL/, "출결이 찍힌 좌석은 제외해야 한다");
    assert.doesNotMatch(statement, /SET status='SCHEDULED', kind=/, "kind 를 바꾸면 안 된다");
  }
});

test("PgBouncer 대응으로 raw 쿼리 패턴을 유지한다", () => {
  assert.match(lib, /prisma\.\$queryRawUnsafe/);
  assert.match(lib, /prisma\.\$executeRawUnsafe/);
  assert.doesNotMatch(libCode, /prisma\.specialProgramEnrollmentDate\./);
});

test("승인된 신청 항목만 슬롯을 만든다", () => {
  assert.match(lib, /item\.status !== "APPROVED"/);
  assert.match(lib, /ITEM_NOT_APPROVED/);
});

test("요일 매칭은 서울시간 기준 요일 유틸을 재사용한다", () => {
  assert.match(lib, /import \{ weekdayInSeoul \} from "@\/lib\/seasonal\/planning"/);
  assert.match(lib, /wanted\.includes\(weekdayInSeoul\(startsAt\)\)/);
});

test("선택 요일이 없으면 특강 전 회차를 생성한다", () => {
  assert.match(lib, /if \(wanted\.length === 0\) return \[\.\.\.sessionDates\]/);
});

test("한글·풀네임 요일도 표준 키로 정규화하고 알 수 없는 값은 버린다", () => {
  for (const alias of ["MONDAY", "월요일", "SUNDAY", "일요일"]) {
    assert.ok(lib.includes(alias), `요일 별칭 누락: ${alias}`);
  }
  assert.match(lib, /filter\(\(weekday\): weekday is SeasonalWeekday => Boolean\(weekday\)\)/);
});

test("승인 처리 실패를 막기 위해 슬롯 생성 예외는 로그만 남긴다", () => {
  assert.match(lib, /export async function syncEnrollmentDatesForItemSafe/);
  assert.match(lib, /console\.error\("\[seasonal enrollment-dates sync\]"/);
});

test("단건 승인과 일괄 승인 경로 모두에서 슬롯 생성을 호출한다", () => {
  assert.match(route, /import \{[^}]*syncEnrollmentDatesForItemSafe[^}]*\} from "@\/lib\/seasonal\/enrollment-dates"/);
  const calls = route.match(/await syncEnrollmentDatesForItemSafe\(/g) ?? [];
  assert.equal(calls.length, 2, "단건 승인 1회 + 일괄 승인 1회를 호출해야 한다");
  assert.match(route, /if \(changed\.item\.status === "APPROVED"\) await syncEnrollmentDatesForItemSafe\(itemId\);/);
  assert.match(route, /if \(changed\.item\.status === "APPROVED"\) await syncEnrollmentDatesForItemSafe\(id\);/);
});

test("슬롯 생성은 승인 트랜잭션 커밋 이후에 실행한다", () => {
  // $transaction 콜백 안에서 호출하면 슬롯 실패가 승인 롤백으로 이어진다.
  const transactionBlocks = route.match(/prisma\.\$transaction\([\s\S]{0,400}?\);/g) ?? [];
  for (const block of transactionBlocks) {
    assert.doesNotMatch(block, /syncEnrollmentDatesForItemSafe/);
  }
});
