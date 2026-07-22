import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const paymentPage = await readFile(new URL("../src/app/payments/[invoiceId]/page.tsx", import.meta.url), "utf8");
const proxy = await readFile(new URL("../src/proxy.ts", import.meta.url), "utf8");

test("미인증 결제 링크는 원래 청구서 주소를 보존해 로그인으로 이동한다", () => {
  assert.match(paymentPage, /const paymentPath = `\/payments\/\$\{encodeURIComponent\(invoiceId\)\}`/);
  assert.match(paymentPage, /requireVerifiedParent\(\)\.catch\(\(\) => null\)/);
  assert.match(paymentPage, /redirect\(`\/login\?redirect=\$\{encodeURIComponent\(paymentPath\)\}`\)/);
});

test("결제 경로는 인증 세션 갱신 matcher에 포함된다", () => {
  assert.match(proxy, /"\/payments\/:path\*"/);
});

test("로그인 뒤 내부 결제 주소로 복귀할 수 있는 기존 안전 경로 계약을 유지한다", async () => {
  const authRoutes = await readFile(new URL("../src/lib/auth-routes.ts", import.meta.url), "utf8");
  assert.match(authRoutes, /if \(canRoleAccessPath\(role, requestedPath\)\) return requestedPath as string/);
});
