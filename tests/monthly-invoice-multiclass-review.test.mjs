import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const admin = readFileSync("src/app/actions/admin.ts", "utf8");
const ui = readFileSync("src/app/admin/finance/FinanceClient.tsx", "utf8");
const sql = admin.slice(admin.indexOf("const MONTHLY_INVOICE_TARGETS_SQL"), admin.indexOf("export async function previewMonthlyInvoices"));
const previewSource = admin.slice(admin.indexOf("export async function previewMonthlyInvoices"), admin.indexOf("// ── 월별 청구서 자동 생성"));
const generateSource = admin.slice(admin.indexOf("export async function generateMonthlyInvoices"), admin.indexOf("// ── 미납 알림 일괄 발송"));

test("다반 수강은 누락하지 않고 반 목록과 REVIEW 사유를 반환한다", () => {
  assert.doesNotMatch(sql, /HAVING COUNT\(DISTINCT a\."classId"\) = 1/);
  assert.match(sql, /ARRAY_AGG\(DISTINCT "className" ORDER BY "className"\) AS "classNames"/);
  assert.match(sql, /CASE WHEN tp\."totalClassCount" > 1 THEN 'REVIEW'/);
  assert.match(sql, /WHEN tp\."totalClassCount" > 1 THEN '여러 반 수강:/);
  // 기존 납부가 여러 건이어도 REVIEW 항목 자체가 중복되지 않는다.
  assert.match(sql, /AND p\.type = tp\.type[\s\S]*AND tp\."totalClassCount" = 1/);
});

test("REVIEW는 생성과 금액 합계에서 제외하고 반 수로 금액을 곱하지 않는다", () => {
  assert.match(previewSource, /COUNT\(CASE WHEN action = 'REVIEW' THEN 1 END\)::int AS "reviewCount"/);
  assert.match(previewSource, /SUM\(CASE WHEN action = 'CREATE' THEN amount ELSE 0 END\)/);
  assert.match(generateSource, /WHERE action = 'CREATE'/);
  assert.match(generateSource, /excludeStudentIds/);
  assert.doesNotMatch(sql + generateSource, /amount\s*\*|\*\s*(?:tp\.)?"classCount"/);
  assert.doesNotMatch(generateSource, /sendInvoice|sendSms|sendNotification/);
});

test("다른 프로그램에 한 반씩 등록해도 전체 활성 반 수로 REVIEW 판정한다", () => {
  const totals = sql.slice(sql.indexOf("student_class_totals AS"), sql.indexOf("target_pairs AS"));
  assert.match(totals, /COUNT\(DISTINCT "classId"\)::int AS "totalClassCount"/);
  assert.match(totals, /FROM active_enrollments\s+GROUP BY "studentId"/);
  assert.doesNotMatch(totals, /programId/);
  assert.match(sql, /JOIN student_class_totals sc ON sc\."studentId" = a\."studentId"/);
  assert.match(sql, /sc\."totalClassCount" AS "classCount"/);
});

test("월 발행은 이번에 생성된 Payment ID만 전달하고 0건도 빈 범위로 제한한다", async () => {
  for (const insertedRows of [[{ id: "new-one" }, { id: "new-two" }], []]) {
    const calls = [];
    let locked = false;
    const tx = { $executeRawUnsafe: async (query, key) => {
      assert.match(query, /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
      assert.equal(key, "monthly-invoice:2026:9");
      locked = true;
    }, $queryRawUnsafe: async (query, ...args) => {
      assert.equal(locked, true, "동일 연월 잠금 이후에만 INSERT합니다.");
      assert.match(query, /WHERE action = 'CREATE'[\s\S]*RETURNING id/);
      assert.equal(args[3], "excluded-student");
      return insertedRows;
    } };
    const testModule = { exports: {} };
    const compiled = ts.transpile(generateSource, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
    new Function("module", "exports", "prisma", "requireAdmin", "ensurePaymentColumns", "ensureBillingTemplateTable", "previewMonthlyInvoices", "MONTHLY_INVOICE_TARGETS_SQL", "monthlyBillingDueDate", "ensureInvoicesForMonth", "revalidateFinanceCaches", "ensurePaymentInfrastructure", compiled)(
      testModule, testModule.exports,
      { $transaction: async (callback) => callback(tx) },
      async () => {}, async () => {}, async () => {},
      async () => ({ activeTemplateCount: 1, skipCount: 1, reviewCount: 2 }),
      "WITH fixture AS ()", () => "2026-08-31",
      async (...args) => { calls.push(args); return { invoiceCount: args[2].length }; },
      () => {}, async () => {},
    );
    const result = await testModule.exports.generateMonthlyInvoices(2026, 9, ["excluded-student"]);
    assert.deepEqual(calls, [[2026, 9, insertedRows.map(row => row.id), tx]]);
    assert.equal(result.created, insertedRows.length);
    assert.equal(result.skipped, 1);
  }
});

test("청구서 실패 시 신규 납부도 롤백하고 재시도할 수 있다 (가짜 거래 모델)", async () => {
  const committed = [];
  const order = [];
  let failInvoice = true;
  const prisma = { $transaction: async (callback) => {
    order.push("transaction");
    const pending = [];
    const tx = { $executeRawUnsafe: async () => { order.push("lock"); }, $queryRawUnsafe: async () => {
      const rows = [{ id: "new-payment" }];
      pending.push(...rows);
      return rows;
    } };
    // 실제 DB 호출이 아니라 callback 성공 때만 저장하는 롤백 모형이다.
    const result = await callback(tx);
    committed.push(...pending);
    return result;
  } };
  const testModule = { exports: {} };
  const compiled = ts.transpile(generateSource, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  new Function("module", "exports", "prisma", "requireAdmin", "ensurePaymentColumns", "ensureBillingTemplateTable", "previewMonthlyInvoices", "MONTHLY_INVOICE_TARGETS_SQL", "monthlyBillingDueDate", "ensureInvoicesForMonth", "revalidateFinanceCaches", "ensurePaymentInfrastructure", "console", compiled)(
    testModule, testModule.exports, prisma, async () => {}, async () => {}, async () => {},
    async () => ({ activeTemplateCount: 1, skipCount: 0 }), "WITH fixture AS ()", () => "2026-08-31",
    async (_year, _month, ids, tx) => {
      assert.deepEqual(ids, ["new-payment"]);
      assert.equal(typeof tx.$queryRawUnsafe, "function");
      if (failInvoice) throw new Error("fixture invoice failure");
      return { invoiceCount: 1 };
    },
    () => {}, async () => { order.push("infrastructure"); }, { error: () => {} },
  );
  await assert.rejects(testModule.exports.generateMonthlyInvoices(2026, 9), /월별 청구서 생성 실패/);
  assert.deepEqual(committed, []);
  assert.deepEqual(order, ["infrastructure", "transaction", "lock"]);
  failInvoice = false;
  const result = await testModule.exports.generateMonthlyInvoices(2026, 9);
  assert.equal(result.created, 1);
  assert.deepEqual(committed, [{ id: "new-payment" }]);
});

test("미리보기는 CREATE/SKIP/REVIEW 및 전체 반 정보를 직렬화한다 (외부 DB 미호출)", async () => {
  const items = [
    { studentId: "one", classCount: 1, classNames: ["월요반"], action: "CREATE", amount: 80000 },
    { studentId: "paid", classCount: 1, classNames: ["화요반"], action: "SKIP", amount: 90000 },
    { studentId: "multi", classCount: 2, classNames: ["목요반", "수요반"], action: "REVIEW", amount: 80000, issueReason: "여러 반 수강" },
  ];
  const summary = { activeTemplateCount: 1, targetStudentCount: 3, createCount: 1, skipCount: 1, reviewCount: 1, createAmount: 80000, skipAmount: 90000 };
  const queryCalls = [];
  const prisma = { $queryRawUnsafe: async (query, ...args) => {
    queryCalls.push({ query, args });
    return query.includes('AS "activeTemplateCount"') ? [summary] : items;
  } };
  const testModule = { exports: {} };
  const compiled = ts.transpile(previewSource, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  new Function("module", "exports", "prisma", "requireAdmin", "ensurePaymentColumns", "ensureBillingTemplateTable", "MONTHLY_INVOICE_TARGETS_SQL", "monthlyBillingDueDate", compiled)(
    testModule, testModule.exports, prisma, async () => {}, async () => {}, async () => {}, "WITH fixture AS ()", () => "2026-08-31",
  );
  const result = await testModule.exports.previewMonthlyInvoices(2026, 9);
  assert.equal(result.reviewCount, 1);
  assert.equal(result.createCount, 1);
  assert.equal(result.skipCount, 1);
  assert.equal(result.createAmount, 80000);
  assert.deepEqual(result.items[2].classNames, ["목요반", "수요반"]);
  assert.equal(result.samples[2].action, "REVIEW");
  assert.equal(result.items[2].classCount, 2);
  assert.equal(queryCalls.length, 2);
  assert.ok(queryCalls.every(call => call.args[0] === 2026 && call.args[1] === 9));
});

test("화면은 다반 이름과 발행 제외를 표시하고 발행 후보는 CREATE만 선택한다", () => {
  assert.match(ui, /if \(item\.action === "REVIEW"\) return true/);
  assert.match(ui, /first\.classNames\.join\(" · "\)/);
  assert.match(ui, /확인 필요 · 발행 제외/);
  assert.match(ui, /item\.action === "REVIEW" \? "금액 산정 보류"/);
  assert.match(ui, /item\.action === "CREATE" && !excluded\.includes\(item\.studentId\)/);
  assert.match(ui, /const hasCreate = studentItems\.some\(\(i\) => i\.action === "CREATE"\)/);
});
