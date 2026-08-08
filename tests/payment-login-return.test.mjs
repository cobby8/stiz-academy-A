import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

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
  // 소스 한 줄을 글자 그대로 단정하면 인자 하나만 늘어도 깨진다.
  // 지켜야 할 것은 문장이 아니라 동작이므로 실제로 실행해서 확인한다.
  const authRoutes = await readFile(new URL("../src/lib/auth-routes.ts", import.meta.url), "utf8");
  const transpiled = ts.transpileModule(authRoutes, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { resolveRedirectForRole } = await import(
    `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`
  );

  const invoicePath = "/payments/inv_123";
  assert.equal(resolveRedirectForRole("PARENT", invoicePath), invoicePath);
  // 로그인 화면으로 되돌리거나 외부로 나가는 주소는 따라가지 않는다.
  assert.equal(resolveRedirectForRole("PARENT", "//evil.example/payments/x"), "/mypage");
  assert.equal(resolveRedirectForRole("PARENT", "/login"), "/mypage");
});
