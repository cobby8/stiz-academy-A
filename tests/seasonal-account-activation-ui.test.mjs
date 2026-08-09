import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const admin = await readFile(new URL("../src/app/admin/seasonal/SeasonalAdminClient.tsx", import.meta.url), "utf8");

test("신규 보호자는 결제 링크 대신 일회용 활성화 링크를 재발급한다", () => {
  assert.match(admin, /if \(item\.invoice\?\.accountActivationRequired\) return null/);
  assert.match(admin, /resource: "accountActivation", id: item\.id, data: \{ action: "reissue" \}/);
  assert.match(admin, /body\.activationUrl/);
  // "계정 활성화 안내" → "입학 가입 안내"로 재구성되며 라벨이 바뀌었다(07e6143).
  // 지켜야 할 것은 "신규 보호자에게는 결제 링크가 아니라 일회용 링크를 재발급한다"는 동작이다.
  assert.match(admin, /activationRequired \? "가입 링크 재발급·복사" : "결제 링크 복사"/);
});

test("활성화된 보호자는 기존 결제 링크를 사용한다", () => {
  assert.match(admin, /if \(item\.invoice\?\.checkoutUrl\) return item\.invoice\.checkoutUrl/);
  assert.match(admin, /`\/payments\/\$\{encodeURIComponent\(item\.invoice\.id\)\}`/);
  assert.match(admin, /결제 링크 복사/);
});
