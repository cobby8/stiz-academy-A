import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSeasonalRows, applySeasonalImport, assertApplyAllowed, parseCsv } from "./seasonal-import.mjs";

function row(index, overrides = {}) {
  return {
    학생명: `학생${index}`,
    생년월일: `201${index % 10}-01-01`,
    학부모연락처: `010-1234-${String(index).padStart(4, "0")}`,
    학부모명: `보호자${index}`,
    회원구분: index <= 13 ? "신규" : "기존",
    반: index <= 17 ? "초등고" : index <= 20 ? "초등저" : "중등",
    신청요일: "월,수",
    수강료: "180,000원",
    차량신청: index <= 14 ? "예" : "아니오",
    ...overrides,
  };
}

test("CSV의 쉼표와 따옴표를 안전하게 읽는다", () => {
  const rows = parseCsv('학생명,메모\r\n"홍,길동","따옴표 ""확인"""\r\n');
  assert.deepEqual(rows, [{ 학생명: "홍,길동", 메모: '따옴표 "확인"' }]);
});

test("21명 미리보기에서 분류와 예외를 개인정보 없이 집계한다", () => {
  const rows = Array.from({ length: 21 }, (_, index) => row(index + 1));
  rows[2].수강료 = "";
  rows[8].수강료 = "";
  rows[16].수강료 = "";
  rows[20].신청요일 = "";
  const { summary, records } = analyzeSeasonalRows(rows, { seasonSlug: "2026-summer-special" });

  assert.equal(summary.total, 21);
  assert.deepEqual(summary.applicantTypes, { NEW: 13, EXISTING: 8 });
  assert.deepEqual(summary.classes, { ELEMENTARY_HIGH: 17, ELEMENTARY_LOW: 3, MIDDLE: 1 });
  assert.equal(summary.tuition.missingCount, 3);
  assert.equal(summary.exceptions.MISSING_WEEKDAYS, 1);
  assert.equal(summary.shuttleRequested, 14);
  assert.equal(summary.requiresReview, 4);
  assert.deepEqual(records[0].selectedWeekdays, ["MON", "WED"]);
  assert.equal(records[0].idempotencyKey, analyzeSeasonalRows([rows[0]], { seasonSlug: "2026-summer-special" }).records[0].idempotencyKey);
  assert.equal(JSON.stringify(summary).includes("학생1"), false);
  assert.equal(JSON.stringify(summary).includes("010"), false);
});

test("같은 학생의 중복 신청을 찾아낸다", () => {
  const repeated = row(1);
  const { summary, records } = analyzeSeasonalRows([repeated, { ...repeated }], { seasonSlug: "summer" });
  assert.equal(summary.duplicates, 1);
  assert.equal(records[1].requiresReview, true);
  assert.ok(records[1].reviewReasons.includes("DUPLICATE_APPLICATION"));
});

test("apply는 확인 토큰과 review 허용 여부를 검사한다", () => {
  assert.throws(() => assertApplyAllowed(["--apply"], {}, { requiresReview: 0 }), /confirm 토큰/);
  assert.throws(
    () => assertApplyAllowed(["--apply", "--confirm", "token"], { SEASONAL_IMPORT_CONFIRM_TOKEN: "token" }, { requiresReview: 1 }),
    /확인이 필요한 신청/,
  );
  assert.doesNotThrow(() => assertApplyAllowed(["--apply", "--confirm", "token"], { SEASONAL_IMPORT_CONFIRM_TOKEN: "token" }, { requiresReview: 0 }));
  assert.doesNotThrow(() => assertApplyAllowed(["--apply", "--allow-review", "--confirm", "token"], { SEASONAL_IMPORT_CONFIRM_TOKEN: "token" }, { requiresReview: 1 }));
});

test("apply는 한 트랜잭션에서 application/item/shuttle/audit를 멱등 처리한다", async () => {
  const records = analyzeSeasonalRows([row(1)], { seasonSlug: "summer" }).records;
  const calls = [];
  const adapter = {
    transaction: async (work) => {
      calls.push("transaction");
      return work({
        findSeasonBySlug: async () => ({ id: "season-1" }),
        findOfferings: async () => [{ id: "offering-1", code: "HIGH-2", title: "초등고 주2회" }],
        upsertApplication: async (data) => {
          calls.push(["application", data]);
          return { application: { id: "application-1" }, created: true };
        },
        upsertItem: async (data) => {
          calls.push(["item", data]);
          return { item: { id: "item-1" }, created: true };
        },
        upsertShuttle: async (data) => calls.push(["shuttle", data]),
        createAudit: async (data) => calls.push(["audit", data]),
      });
    },
  };
  const result = await applySeasonalImport({
    adapter,
    seasonSlug: "summer",
    source: "google-sheet:summer-2026",
    records,
    offeringMap: { "ELEMENTARY_HIGH:2": "HIGH-2" },
  });

  assert.deepEqual(result, { created: 1, updated: 0, itemCreated: 1, reviewOnly: 0 });
  assert.deepEqual(calls.map((call) => Array.isArray(call) ? call[0] : call), ["transaction", "application", "item", "shuttle", "audit"]);
  assert.equal(calls[1][1].childName, "학생1");
  assert.equal(calls[1][1].importSource, "google-sheet:summer-2026");
  assert.equal(calls[1][1].status, "PENDING");
  assert.equal(calls[2][1].status, "PENDING");
});

test("금액 또는 반 매핑이 없으면 allow-review에서도 신청서만 만든다", async () => {
  const records = analyzeSeasonalRows([row(1, { 수강료: "" })], { seasonSlug: "summer" }).records;
  const calls = [];
  const adapter = {
    transaction: (work) => work({
      findSeasonBySlug: async () => ({ id: "season-1" }),
      findOfferings: async () => [],
      upsertApplication: async (data) => {
        calls.push(["application", data]);
        return { application: { id: "application-1" }, created: true };
      },
      upsertItem: async () => calls.push("item"),
      upsertShuttle: async () => calls.push("shuttle"),
      createAudit: async (data) => calls.push(["audit", data]),
    }),
  };
  const result = await applySeasonalImport({ adapter, seasonSlug: "summer", source: "sheet", records, offeringMap: {}, allowReview: true });

  assert.equal(result.reviewOnly, 1);
  assert.equal(calls.some((call) => call === "item" || call === "shuttle"), false);
  assert.equal(calls[0][1].totalPriceSnapshot, 0);
  assert.equal(calls[0][1].requiresReview, true);
  assert.equal(calls[0][1].status, "PENDING");
});
