import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const adminShell = read("../src/app/admin/AdminShellClient.tsx");
const globalsCss = read("../src/app/globals.css");
const quickActionMenu = read("../src/components/admin/AdminQuickActionMenu.tsx");

const quickActionClients = [
  "../src/app/admin/annual/AnnualAdminClient.tsx",
  "../src/app/admin/classes/ClassManagementClient.tsx",
  "../src/app/admin/coaches/CoachesAdminClient.tsx",
  "../src/app/admin/finance/FinanceClient.tsx",
  "../src/app/admin/finance/billing/BillingTemplateClient.tsx",
  "../src/app/admin/students/StudentManagementClient.tsx",
];

test("관리자 페이지는 전역 테이블 규칙 스코프를 한 번만 건다", () => {
  assert.match(adminShell, /admin-table-scope w-full min-w-0 flex-1/);
});

test("관리자 전역 테이블은 콤팩트 중앙 정렬 규칙을 공유한다", () => {
  assert.match(globalsCss, /\.admin-table-scope table/);
  assert.match(globalsCss, /table-layout:\s*fixed/);
  assert.match(globalsCss, /padding:\s*0\.5rem !important/);
  assert.match(globalsCss, /text-align:\s*center !important/);
  assert.match(globalsCss, /vertical-align:\s*middle !important/);
  assert.match(globalsCss, /justify-content:\s*center !important/);
  assert.match(globalsCss, /overflow-y:\s*visible/);
});

test("관리자 퀵액션 메뉴는 표 박스에 잘리지 않는 fixed floating 메뉴다", () => {
  assert.match(quickActionMenu, /fixed z-\[90\]/);
  assert.match(quickActionMenu, /flash_on/);
  assert.match(quickActionMenu, /pointerdown/);
  assert.match(quickActionMenu, /scroll", placeMenu, true/);
});

test("반복 관리 액션은 퀵액션 메뉴로 묶고 행별 삭제 확인 상태를 제거한다", () => {
  for (const path of quickActionClients) {
    const source = read(path);
    assert.match(source, /AdminQuickActionMenu/);
    assert.doesNotMatch(source, /deleteConfirm|setDeleteConfirm/);
  }
});
