import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ledger = readFileSync(new URL("../src/lib/payment-ledger.ts", import.meta.url), "utf8");
const checkoutRoute = readFileSync(new URL("../src/app/api/payments/checkout/route.ts", import.meta.url), "utf8");
const checkoutClient = readFileSync(
  new URL("../src/app/payments/[invoiceId]/PaymentCheckoutClient.tsx", import.meta.url),
  "utf8",
);
const invoicePage = readFileSync(new URL("../src/app/payments/[invoiceId]/page.tsx", import.meta.url), "utf8");
const successClient = readFileSync(
  new URL("../src/app/payments/success/PaymentSuccessClient.tsx", import.meta.url),
  "utf8",
);
const failPage = readFileSync(new URL("../src/app/payments/fail/page.tsx", import.meta.url), "utf8");
const financeClient = readFileSync(new URL("../src/app/admin/finance/FinanceClient.tsx", import.meta.url), "utf8");
const adminPayload = readFileSync(new URL("../src/lib/adminReadPayloads.ts", import.meta.url), "utf8");
const paymentPreflight = readFileSync(new URL("../scripts/payment-preflight.mjs", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");

test("토스 결제 세션은 운영 준비와 결제 가능 상태를 먼저 확인한다", () => {
  assert.match(ledger, /getPaymentProviderPublicStatus/);
  assert.match(ledger, /clientKeyConfigured/);
  assert.match(ledger, /secretKeyConfigured/);
  assert.match(ledger, /inferTossKeyMode/);
  assert.match(ledger, /keyPairReady/);
  assert.match(ledger, /siteUrlConfigured/);
  assert.match(ledger, /webhookUrl/);
  assert.match(ledger, /PUBLIC_SITE_URL/);
  assert.match(ledger, /\["REFUNDED", "CANCELED"\]\.includes\(invoice\.paymentStatus\)/);
  assert.match(ledger, /Number\(invoice\.amount\) <= 0/);
  assert.match(ledger, /configurationMissing: true/);
  assert.match(checkoutRoute, /configurationMissing" in result/);
  assert.match(checkoutRoute, /\?\s*503/);
});

test("토스 결제 요청 URL과 고객키는 재사용 가능하고 개인정보를 직접 노출하지 않는다", () => {
  assert.match(ledger, /createHash/);
  assert.match(ledger, /makeTossCustomerKey/);
  assert.match(ledger, /digest\("base64url"\)/);
  assert.match(ledger, /return `stiz_\$\{digest\}`/);
  assert.match(ledger, /makePaymentReturnUrl\(cleanOrigin, "\/payments\/success", invoice\.invoiceId\)/);
  assert.match(ledger, /makePaymentReturnUrl\(cleanOrigin, "\/payments\/fail", invoice\.invoiceId\)/);
  assert.match(ledger, /searchParams\.set\("invoiceId", invoiceId\)/);
  assert.match(ledger, /AND amount = \$2/);
});

test("토스 승인 처리에는 멱등키와 재시도 보호가 있다", () => {
  assert.match(ledger, /Idempotency-Key/);
  assert.match(ledger, /isUuidLike/);
  assert.match(ledger, /makeUuidFromSeed/);
  assert.match(ledger, /makeTossIdempotencyKey\(tx\.id, input\.orderId\)/);
  assert.match(ledger, /SET status = 'IN_PROGRESS'/);
  assert.match(ledger, /status = CASE WHEN \$6::boolean THEN status ELSE 'FAILED' END/);
  assert.match(ledger, /retryable/);
});

test("학부모 결제 화면은 토스 SDK 결과를 검증하고 안내 화면으로 복귀시킨다", () => {
  assert.match(checkoutClient, /https:\/\/js\.tosspayments\.com\/v2\/standard/);
  assert.match(checkoutClient, /requestPayment/);
  assert.match(checkoutClient, /data\.orderId/);
  assert.match(checkoutClient, /data\.amount/);
  assert.match(checkoutClient, /data\.successUrl/);
  assert.match(checkoutClient, /data\.failUrl/);
  assert.match(successClient, /api\/payments\/toss\/confirm/);
  assert.match(successClient, /paymentKey/);
  assert.match(successClient, /orderId/);
  assert.match(successClient, /amount/);
  assert.match(successClient, /invoiceId/);
  assert.match(failPage, /params\.invoiceId/);
  assert.match(invoicePage, /PaymentCheckoutClient/);
});

test("관리자는 온라인 결제 운영 준비 상태를 개발 메시지 없이 확인한다", () => {
  assert.match(adminPayload, /getPaymentProviderPublicStatus/);
  assert.match(financeClient, /paymentProviderMissing/);
  assert.match(financeClient, /clientKeyConfigured/);
  assert.match(financeClient, /secretKeyConfigured/);
  assert.match(financeClient, /siteUrlConfigured/);
  assert.match(financeClient, /keyPairReady/);
  assert.match(financeClient, /webhookUrl/);
});

test("관리자는 수납 목록에서 청구서 링크를 바로 열고 복사할 수 있다", () => {
  assert.match(financeClient, /getInvoiceHref/);
  assert.match(financeClient, /toAbsoluteHref/);
  assert.match(financeClient, /navigator\.clipboard\.writeText/);
  assert.match(financeClient, /window\.open/);
});

test("결제 전용 프리플라이트는 비밀값 없이 키 종류와 URL만 점검한다", () => {
  assert.match(packageJson, /"payments:preflight"/);
  assert.match(paymentPreflight, /inferTossKeyMode/);
  assert.match(paymentPreflight, /NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY/);
  assert.match(paymentPreflight, /TOSS_PAYMENTS_SECRET_KEY/);
  assert.match(paymentPreflight, /NEXT_PUBLIC_SITE_URL/);
  assert.match(paymentPreflight, /DEFAULT_PUBLIC_SITE_URL/);
  assert.match(paymentPreflight, /토스 관리자 웹훅 등록 주소/);
  assert.match(paymentPreflight, /운영 배포에는 토스 실거래 키가 필요합니다/);
  assert.match(paymentPreflight, /서버키: \$\{secretKey \? "있음" : "없음"\}/);
  assert.doesNotMatch(paymentPreflight, /서버키: \$\{secretKey\}/);
});
