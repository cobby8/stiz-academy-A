import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ownerOnlyRoutes = [
  "../src/app/api/admin/backup/route.ts",
  "../src/app/api/admin/backup-now/route.ts",
  "../src/app/api/admin/cloud-backups/route.ts",
  "../src/app/api/admin/diagnostics/route.ts",
  "../src/app/api/admin/export-seed/route.ts",
  "../src/app/api/admin/seed/route.ts",
];

test("백업·복원·진단·시드 API는 원장 권한으로만 보호한다", () => {
  for (const path of ownerOnlyRoutes) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /requireOwner/);
    assert.doesNotMatch(source, /auth\.getUser\(\)/);
  }
});

test("엑셀 파싱 API는 단순 로그인 대신 관리자 권한을 확인한다", () => {
  const source = readFileSync(
    new URL("../src/app/api/admin/parse-excel/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /requireAdmin/);
  assert.doesNotMatch(source, /auth\.getUser\(\)/);
});
