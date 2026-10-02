import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadTsModule } from "./_ts-module.mjs";

// 토스페이먼츠 가맹 심사용 테스트 결제(2026-10-02).
// 가장 큰 위험: 테스트 키가 학부모 청구서 결제에 섞이면, 테스트 카드 "결제"로 청구서가
// 돈 없이 납부 완료가 된다. 그래서 심사용은 TOSS_REVIEW_* 만 읽고, 라이브 키면 꺼진다.

const {
    readTossReviewConfig, resolveReviewOrder, makeReviewOrderId, isReviewOrderId, isReviewPriceTier,
} = await loadTsModule("src/lib/payments/tossReview.ts");

test("두 키가 모두 test_ 일 때만 켜진다 — 라이브 키·빈 값·한쪽만은 꺼짐", () => {
    assert.ok(readTossReviewConfig({ TOSS_REVIEW_CLIENT_KEY: "test_ck_a", TOSS_REVIEW_SECRET_KEY: "test_sk_b" }));
    assert.equal(readTossReviewConfig({ TOSS_REVIEW_CLIENT_KEY: "live_ck_a", TOSS_REVIEW_SECRET_KEY: "live_sk_b" }), null);
    assert.equal(readTossReviewConfig({ TOSS_REVIEW_CLIENT_KEY: "test_ck_a", TOSS_REVIEW_SECRET_KEY: "live_sk_b" }), null);
    assert.equal(readTossReviewConfig({ TOSS_REVIEW_CLIENT_KEY: "test_ck_a" }), null);
    assert.equal(readTossReviewConfig({}), null);
});

test("청구서 결제용 키(TOSS_PAYMENTS_*)로는 켜지지 않는다", () => {
    assert.equal(readTossReviewConfig({ TOSS_PAYMENTS_CLIENT_KEY: "test_ck_a", TOSS_PAYMENTS_SECRET_KEY: "test_sk_b" }), null);
});

test("앞뒤 공백·줄바꿈이 붙은 키도 읽는다(PowerShell 파이프 사고 재발 방지)", () => {
    const config = readTossReviewConfig({ TOSS_REVIEW_CLIENT_KEY: " test_ck_a\r\n", TOSS_REVIEW_SECRET_KEY: "test_sk_b\n" });
    assert.deepEqual(config, { clientKey: "test_ck_a", secretKey: "test_sk_b" });
});

const program = { name: "초등 기초반", price: 150000, priceWeek1: 120000, priceWeek2: 0, priceWeek3: null, priceDaily: null };

test("금액은 서버의 프로그램 가격 칸에서 정한다", () => {
    assert.deepEqual(resolveReviewOrder(program, "price"), { amount: 150000, orderName: "초등 기초반 월 수강료" });
    assert.deepEqual(resolveReviewOrder(program, "priceWeek1"), { amount: 120000, orderName: "초등 기초반 주 1회 월 수강료" });
});

test("0원·빈 가격 칸은 결제창을 열지 않는다", () => {
    assert.equal(resolveReviewOrder(program, "priceWeek2"), null);
    assert.equal(resolveReviewOrder(program, "priceWeek3"), null);
});

test("가격 칸 이름은 정해진 것만 받는다 — 다른 컬럼을 금액으로 쓰지 못하게", () => {
    assert.ok(isReviewPriceTier("priceDaily"));
    assert.equal(isReviewPriceTier("shuttleFeeOverride"), false);
    assert.equal(isReviewPriceTier(undefined), false);
});

test("주문번호는 REVIEW- 로 시작하고 토스 규칙(영문·숫자·-·_ 64자 이하)을 지킨다", () => {
    const id = makeReviewOrderId("3f2b9c1e-1111-4a2b-9c3d-abcdefabcdef");
    assert.match(id, /^REVIEW-[A-Za-z0-9]+$/);
    assert.ok(id.length >= 6 && id.length <= 64);
    assert.ok(isReviewOrderId(id));
    assert.equal(isReviewOrderId("ORDER-123456"), false, "청구서 주문번호로는 승인하지 않는다");
});

test("심사용 결제 코드는 청구서·납부 기록을 건드리지 않는다", async () => {
    for (const file of [
        "src/app/api/payments/toss-review/checkout/route.ts",
        "src/app/payments/review/success/page.tsx",
    ]) {
        const source = await readFile(file, "utf8");
        // "deletedAt" 같은 컬럼 이름에 걸리지 않게 실제 쓰기 구문 모양만 찾는다.
        assert.doesNotMatch(source, /INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM|payment-ledger|markPaymentPaid|\$executeRaw/i, `${file} 에 쓰기 구문이 생겼습니다`);
    }
});
