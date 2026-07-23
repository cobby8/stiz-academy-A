import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestUrl = new URL("../public/manifest-staff.json", import.meta.url);
const serviceWorkerUrl = new URL("../public/sw.js", import.meta.url);

test("교사용 앱은 /staff 범위로 독립 설치된다", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  assert.equal(manifest.id, "/staff-app");
  assert.equal(manifest.name, "STIZ 선생님");
  assert.equal(manifest.short_name, "STIZ 교사용");
  assert.equal(manifest.start_url, "/staff");
  assert.equal(manifest.scope, "/staff");
  assert.equal(manifest.orientation, "portrait");
  assert.deepEqual(
    [...new Set(manifest.icons.map(({ purpose }) => purpose))].sort(),
    ["any", "maskable"],
  );
  assert.ok(manifest.icons.every(({ src }) => src.includes("icon-v2") || src.includes("icon-maskable-v2")));
  assert.deepEqual(
    manifest.shortcuts.map(({ name, url }) => ({ name, url })),
    [
      { name: "오늘 수업", url: "/staff" },
      { name: "학생", url: "/staff/students" },
      { name: "청구", url: "/staff/billing" },
    ],
  );
});

test("교사용 manifest만 캐시하고 교사용 화면과 데이터는 저장하지 않는다", async () => {
  const source = await readFile(serviceWorkerUrl, "utf8");
  const precacheSection = source.slice(
    source.indexOf("const PRECACHE_URLS"),
    source.indexOf("const PRIVATE_PATH_PREFIXES"),
  );

  assert.match(source, /"\/manifest-staff\.json"/);
  assert.match(source, /stiz-public-static-v20260724-icon-v2/);
  assert.match(source, /"\/icon-v2-192\.png"/);
  assert.match(source, /"\/icon-v2-512\.png"/);
  assert.match(source, /"\/icon-maskable-v2-192\.png"/);
  assert.match(source, /"\/icon-maskable-v2-512\.png"/);
  assert.match(source, /"\/staff"/);
  assert.match(source, /fetch\(request, \{ cache: "no-store" \}\)/);
  assert.doesNotMatch(precacheSection, /"\/staff"/);
});
