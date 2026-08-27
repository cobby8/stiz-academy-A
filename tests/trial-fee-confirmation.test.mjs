import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { confirmTrialFeeOnce, confirmTrialFeeWithAudit } from "../src/lib/trial-fee-confirmation.ts";

function fakeDb(responses) {
  const calls = [];
  return {
    calls,
    async $queryRawUnsafe(query, ...values) {
      calls.push({ query, values });
      return responses.shift() ?? [];
    },
  };
}

test("미확인 체험비는 조건부 UPDATE 한 번으로 확인되고 추가 조회하지 않는다", async () => {
  const db = fakeDb([[{ id: "trial-1" }]]);
  const result = await confirmTrialFeeOnce(db, "trial-1");

  assert.deepEqual(result, { found: true, changed: true, alreadyConfirmed: false });
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].query, /COALESCE\("trialFeeConfirmed", false\) = false/);
  assert.match(db.calls[0].query, /RETURNING id/);
});

test("이미 확인된 체험비 재요청은 changed=false로 멱등 처리한다", async () => {
  const db = fakeDb([[], [{ trialFeeConfirmed: true }]]);
  const result = await confirmTrialFeeOnce(db, "trial-1");

  assert.deepEqual(result, { found: true, changed: false, alreadyConfirmed: true });
  assert.equal(db.calls.length, 2);
});

test("존재하지 않는 신청 ID는 안전한 결과로 구분한다", async () => {
  const db = fakeDb([[], []]);
  const result = await confirmTrialFeeOnce(db, "missing");

  assert.deepEqual(result, { found: false, changed: false, alreadyConfirmed: false });
});

test("서버 action은 최초 변경일 때만 이력과 캐시 갱신을 수행한다", () => {
  const source = readFileSync("src/app/actions/admin.ts", "utf8");
  const action = source.slice(
    source.indexOf("export async function confirmTrialFeePayment"),
    source.indexOf("export async function updateTrialLead"),
  );
  assert.match(action, /const result = await confirmTrialFeeWithAudit\(prisma, id/);
  assert.match(action, /if \(!result\.found\) return result/);
  assert.doesNotMatch(action, /recordApplicationHistoryLog/);
});

function transactionalFeeDb({ failAudit = false } = {}) {
  const state = { confirmed: false, auditCount: 0 };
  return {
    state,
    async $transaction(callback) {
      const snapshot = { ...state };
      const tx = {
        async $queryRawUnsafe(query) {
          if (query.includes('UPDATE "TrialLead"')) {
            if (state.confirmed) return [];
            state.confirmed = true;
            return [{ id: "trial-1" }];
          }
          return state.confirmed ? [{ trialFeeConfirmed: true }] : [];
        },
        async $executeRawUnsafe() {
          if (failAudit) throw new Error("audit failed");
          state.auditCount += 1;
          return 1;
        },
      };
      try { return await callback(tx); }
      catch (error) { Object.assign(state, snapshot); throw error; }
    },
  };
}

test("동시 입금확인 요청도 값 변경과 감사 이력은 한 번뿐이다", async () => {
  const db = transactionalFeeDb();
  const actor = { userId: "admin-1", userName: "관리자" };
  const results = await Promise.all([
    confirmTrialFeeWithAudit(db, "trial-1", actor),
    confirmTrialFeeWithAudit(db, "trial-1", actor),
  ]);
  assert.equal(results.filter((item) => item.changed).length, 1);
  assert.equal(db.state.auditCount, 1);
});

test("감사 이력 저장 실패 시 입금확인 변경도 rollback된다", async () => {
  const db = transactionalFeeDb({ failAudit: true });
  await assert.rejects(
    confirmTrialFeeWithAudit(db, "trial-1", { userId: "admin-1", userName: "관리자" }),
    /audit failed/,
  );
  assert.deepEqual(db.state, { confirmed: false, auditCount: 0 });
});
