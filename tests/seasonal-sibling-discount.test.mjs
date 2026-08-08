import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const service = await readFile(new URL("../src/lib/seasonal/service.ts", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../src/app/api/admin/seasonal/route.ts", import.meta.url), "utf8");
const sync = await readFile(new URL("../src/lib/seasonal/sibling-discount-sync.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../prisma/migrations/20260726000000_add_sibling_discount/migration.sql", import.meta.url), "utf8");
const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

test("금액을 바꾸는 세 경로가 모두 형제할인 재계산을 부른다", () => {
  // 공개 신청
  assert.match(service, /await syncSeasonSiblingDiscounts\(tx, season\.id\)/);
  // 관리자 반 재배정 + 관리자 항목 추가 (여기가 빠지면 재배정 순간 할인이 사라진다)
  assert.match(adminRoute, /await syncSeasonSiblingDiscounts\(tx, before\.application\.seasonId\)/);
  assert.match(adminRoute, /await syncSeasonSiblingDiscounts\(tx, application\.seasonId\)/);
});

test("관리자 금액 계산이 공개 신청과 같은 함수를 쓴다(중복 구현 제거)", () => {
  assert.doesNotMatch(adminRoute, /function defaultSpecialProgramPrice/);
  assert.doesNotMatch(adminRoute, /function specialProgramShuttleFee/);
  assert.match(adminRoute, /resolveOfferingPrice\(offering, seasonalApplicantType\(params\.applicantType\)\)/);
  assert.match(adminRoute, /resolveShuttleFee\(offering, Boolean\(before\.shuttleRequest\)\)/);
});

test("할인은 언제나 할인 전 수강료에서만 계산한다(멱등)", () => {
  // priceSnapshot 을 다시 입력으로 쓰면 재계산할 때마다 금액이 깎여 나간다.
  assert.match(sync, /"priceSnapshot" = item\."tuitionPriceSnapshot" - computed\.discount \+ item\."shuttleFeeSnapshot"/);
  assert.doesNotMatch(sync, /\("priceSnapshot" \* /);
  assert.doesNotMatch(sync, /FROM\s+item\."priceSnapshot"/);
  // 값이 이미 맞으면 아무 행도 갱신하지 않는 가드가 있어야 한다.
  assert.match(sync, /AND \(item\."siblingDiscountSnapshot" <> computed\.discount/);
});

test("할인율은 정수 연산이라 JS와 SQL 결과가 어긋나지 않는다", () => {
  assert.match(sync, /\(item\."tuitionPriceSnapshot" \* \$\{SIBLING_DISCOUNT_PERCENT\}\) \/ 100/);
});

test("셔틀비는 할인 대상에서 제외된다", () => {
  // 할인은 tuition 에만 곱하고, 셔틀비는 할인 뒤에 더해진다.
  assert.doesNotMatch(sync, /shuttleFeeSnapshot" \* /);
  assert.match(sync, /- computed\.discount \+ item\."shuttleFeeSnapshot"/);
});

test("이미 수강 등록·청구서로 넘어간 항목은 금액을 바꾸지 않는다", () => {
  assert.match(sync, /AND item\."enrollmentId" IS NULL/);
  assert.match(sync, /AND item\."paymentId" IS NULL/);
});

test("취소·반려된 신청은 형제 판정과 금액 갱신에서 빠진다", () => {
  assert.match(sync, /app\.status NOT IN \(\$\{CLOSED_APPLICATION_STATUSES\}\)/);
  assert.match(sync, /item\.status NOT IN \(\$\{CLOSED_ITEM_STATUSES\}\)/);
});

test("형제 번호 집합은 신청서 번호와 원생 보호자 번호의 합집합이다", () => {
  assert.match(sync, /FROM "Student" student\s+JOIN "User" parent ON parent\.id = student\."parentId"/);
  assert.match(sync, /JOIN "Guardian" guardian ON guardian\."studentId" = student\.id/);
  assert.match(sync, /UNION ALL/);
});

test("스키마와 마이그레이션이 할인 스냅샷 컬럼을 갖는다", () => {
  // prisma format 이 열을 맞추면서 공백 개수가 바뀐다. 지켜야 할 것은 필드의 존재·타입이다.
  assert.match(schema, /siblingDiscountSnapshot\s+Int\s+@default\(0\)/);
  assert.match(schema, /discountReasonSnapshot\s+String\?/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "siblingDiscountSnapshot" INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "discountReasonSnapshot" TEXT/);
});

test("금액 제약이 할인을 반영하도록 교체된다", () => {
  // 예전 제약(최종금액 = 수강료 + 셔틀비)이 남아 있으면 할인이 들어가는 순간 저장이 실패한다.
  assert.match(migration, /DROP CONSTRAINT IF EXISTS "SpecialProgramApplicationItem_priceSnapshot_components"/);
  assert.match(migration, /CHECK \("priceSnapshot" = "tuitionPriceSnapshot" - "siblingDiscountSnapshot" \+ "shuttleFeeSnapshot"\)/);
  assert.match(migration, /"siblingDiscountSnapshot" <= "tuitionPriceSnapshot"/);
});

test("마이그레이션은 여러 번 실행해도 안전하다", () => {
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM/i);
  for (const statement of migration.split(";").map((part) => part.trim()).filter(Boolean)) {
    if (!statement.includes("ADD COLUMN")) continue;
    assert.match(statement, /IF NOT EXISTS/);
  }
});
