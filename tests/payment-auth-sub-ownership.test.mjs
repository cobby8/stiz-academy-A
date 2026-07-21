import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ledger = await readFile(new URL("../src/lib/payment-ledger.ts", import.meta.url), "utf8");
const paymentPage = await readFile(new URL("../src/app/payments/[invoiceId]/page.tsx", import.meta.url), "utf8");
const checkout = await readFile(new URL("../src/app/api/payments/checkout/route.ts", import.meta.url), "utf8");
const confirm = await readFile(new URL("../src/app/api/payments/toss/confirm/route.ts", import.meta.url), "utf8");

test("활성화된 보호자는 인증 sub가 연결된 자신의 청구서만 조회한다", () => {
  assert.match(ledger, /u\."authUserId" = \$2/);
  assert.match(paymentPage, /authUserId: user\.id, email: user\.email \?\? null/);
});

test("checkout과 confirm도 같은 sub 우선 소유권 계약을 전달한다", () => {
  assert.match(checkout, /owner: \{ authUserId: user\.id, email: user\.email \?\? null \}/);
  assert.match(confirm, /owner: \{ authUserId: user\.id, email: user\.email \?\? null \}/);
  assert.equal((ledger.match(/u\."authUserId" = \$2/g) ?? []).length, 2);
});

test("이메일 fallback은 authUserId가 없는 기존 보호자에게만 허용된다", () => {
  const fallback = /u\."authUserId" IS NULL AND \$3 <> '' AND LOWER\(u\.email\) = LOWER\(\$3\)/g;
  assert.equal((ledger.match(fallback) ?? []).length, 2);
});
