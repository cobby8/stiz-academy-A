import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const configSource = await readFile("next.config.ts", "utf8");
const middlewareSource = await readFile("src/lib/supabase/middleware.ts", "utf8");
const manifest = JSON.parse(await readFile("public/manifest-staff.json", "utf8"));
const serviceWorkerSource = await readFile("public/sw.js", "utf8");

test("공유용 /staff/install 주소는 공개 설치 페이지로 연결된다", () => {
  assert.match(configSource, /source:\s*["']\/staff\/install["']/);
  assert.match(configSource, /destination:\s*["']\/teacher-app["']/);
  assert.match(middlewareSource, /isStaffInstall\s*=\s*pathname === ["']\/staff\/install["']/);
  assert.match(
    middlewareSource,
    /isStaffPath && !isStaffLogin && !isStaffInstall/,
  );
});

test("설치 안내와 교사용 manifest는 브라우저에 저장하지 않는다", () => {
  const staffPermissionIndex = configSource.indexOf('source: "/staff/:path*"');
  const installPermissionIndex = configSource.indexOf('source: "/staff/install"', staffPermissionIndex);

  assert.match(
    configSource,
    /source:\s*["']\/manifest-staff\.json["'][\s\S]*?no-cache, no-store, must-revalidate/,
  );
  assert.match(
    configSource,
    /source:\s*["']\/staff\/install["'][\s\S]*?no-cache, no-store, must-revalidate/,
  );
  assert.match(
    configSource,
    /source:\s*["']\/teacher-app["'][\s\S]*?no-cache, no-store, must-revalidate/,
  );
  assert.match(
    configSource,
    /source:\s*["']\/staff\/install["'][\s\S]*?noindex, nofollow[\s\S]*?camera=\(\), microphone=\(\)/,
  );
  assert.ok(
    staffPermissionIndex >= 0 && installPermissionIndex > staffPermissionIndex,
    "설치 화면의 권한 차단 규칙은 일반 staff 허용 규칙보다 뒤에서 적용되어야 합니다.",
  );
  assert.match(serviceWorkerSource, /const PRIVATE_PATH_PREFIXES[\s\S]*?["']\/staff["']/);
});

test("앱 시작 주소와 바로가기에 초대 토큰을 포함하지 않는다", () => {
  assert.equal(manifest.start_url, "/staff");
  assert.equal(manifest.scope, "/staff");
  assert.equal(JSON.stringify(manifest).includes("token"), false);
  assert.equal(JSON.stringify(manifest).includes("invite"), false);
});
