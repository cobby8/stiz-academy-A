import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// 공식·선생님·학부모·기사 네 앱은 홈 화면에 따로 설치되고 눈으로 구분돼야 한다.
// id 가 겹치면 브라우저가 같은 앱으로 보고 덮어쓰고, 아이콘이 겹치면 사람이 구분하지 못한다.

const MANIFESTS = {
  public: "public/manifest.json",
  staff: "public/manifest-staff.json",
  parent: "public/manifest-parent.json",
  driver: "public/driver-manifest.json",
};

const loaded = Object.fromEntries(
  await Promise.all(
    Object.entries(MANIFESTS).map(async ([key, path]) => [key, JSON.parse(await readFile(path, "utf8"))]),
  ),
);

const nextConfig = await readFile("next.config.ts", "utf8");
const middleware = await readFile("src/lib/supabase/middleware.ts", "utf8");

test("네 앱의 id 가 서로 겹치지 않는다", () => {
  const ids = Object.entries(loaded).map(([key, m]) => {
    assert.ok(m.id, `${key} manifest 에 id 가 있어야 합니다. 없으면 start_url 로 대체돼 조용히 바뀝니다.`);
    return m.id;
  });
  assert.equal(new Set(ids).size, ids.length, `앱 id 가 겹칩니다: ${ids.join(", ")}`);
});

test("네 앱의 아이콘이 서로 겹치지 않는다", () => {
  const firstIcons = Object.entries(loaded).map(([key, m]) => {
    assert.ok(m.icons?.length, `${key} manifest 에 아이콘이 있어야 합니다.`);
    return m.icons[0].src;
  });
  assert.equal(
    new Set(firstIcons).size,
    firstIcons.length,
    `아이콘이 겹치면 홈 화면에서 구분할 수 없습니다: ${firstIcons.join(", ")}`,
  );
});

test("역할 앱은 자기 영역만 차지한다", () => {
  // scope 가 겹치면 링크를 눌렀을 때 어느 앱이 열릴지 모호해진다.
  assert.equal(loaded.staff.scope, "/staff");
  assert.equal(loaded.staff.start_url, "/staff");
  assert.equal(loaded.parent.scope, "/mypage");
  assert.equal(loaded.parent.start_url, "/mypage");
});

test("설치 안내 화면은 각 앱의 scope 안에 있고 로그인 없이 열린다", () => {
  // scope 밖에서는 브라우저가 설치를 제안하지 않는다.
  assert.match(nextConfig, /source: "\/staff\/install"/);
  assert.match(nextConfig, /source: "\/mypage\/install"/);
  // 짧은 주소 /app 은 rewrite 가 아니라 redirect 여야 한다.
  // 주소가 실제로 /mypage/install 로 바뀌어야 scope 안에 들어간다.
  assert.match(nextConfig, /source: "\/app"[\s\S]{0,200}destination: "\/mypage\/install"/);
  // 설치 안내는 로그인 전에 봐야 하므로 보호 경로에서 제외한다.
  assert.match(middleware, /isStaffInstall/);
  assert.match(middleware, /isMyPageInstall/);
  assert.match(middleware, /isMyPagePath && !isMyPageInstall/);
});
