import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 셔틀 탭바의 활성 판정은 **접두 충돌**이 나기 쉽다.
//   /admin/seasonal/shuttle-notice 는 /admin/seasonal/shuttle 로 시작하고,
//   /admin/shuttle/regular-dispatch 는 /admin/shuttle/regular 로 시작한다.
// 순서를 잘못 두면 안내 화면에서 "명단" 탭이 켜지는 식으로 조용히 어긋난다.

const src = readFileSync(new URL("../src/app/admin/shuttle/ShuttleSectionTabs.tsx", import.meta.url), "utf8");

/** resolveActiveKey 본문을 그대로 떼어 내 실제로 실행해 본다(문자열 검사가 아니라 동작 검증). */
function loadResolver() {
  const start = src.indexOf("function resolveActiveKey");
  const end = src.indexOf("export default function");
  const body = src.slice(start, end);
  return new Function(`${body}; return resolveActiveKey;`)();
}

test("각 경로가 올바른 탭을 켠다 — 접두 충돌 포함", () => {
  const resolve = loadResolver();
  assert.equal(resolve("/admin/seasonal/dispatch"), "dispatch");
  assert.equal(resolve("/admin/seasonal/shuttle"), "roster");
  // ★ 핵심: shuttle-notice 가 roster 로 새면 안 된다.
  assert.equal(resolve("/admin/seasonal/shuttle-notice"), "notice");
  assert.equal(resolve("/admin/shuttle/regular-dispatch"), "regular-dispatch");
  assert.equal(resolve("/admin/shuttle/regular"), "regular");
  assert.equal(resolve("/admin/shuttle"), "vehicle");
});

test("탭 목록에 등원시간 안내가 있고 경로가 실제 페이지와 맞는다", () => {
  assert.match(src, /href: "\/admin\/seasonal\/shuttle-notice"/);
  assert.match(src, /label: "등원시간 안내"/);
});
