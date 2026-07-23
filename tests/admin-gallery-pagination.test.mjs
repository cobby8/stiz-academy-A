import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const adminReadPayloads = readFileSync(new URL("../src/lib/adminReadPayloads.ts", import.meta.url), "utf8");
const galleryRoute = readFileSync(new URL("../src/app/api/admin/gallery/route.ts", import.meta.url), "utf8");
const galleryClient = readFileSync(new URL("../src/app/admin/gallery/GalleryAdminClient.tsx", import.meta.url), "utf8");
const queries = readFileSync(new URL("../src/lib/queries.ts", import.meta.url), "utf8");

test("관리자 갤러리는 첫 화면 게시물 수를 24건으로 제한한다", () => {
  assert.match(adminReadPayloads, /const ADMIN_GALLERY_PAGE_SIZE = 24/);
  assert.doesNotMatch(adminReadPayloads, /getGalleryPosts\(\{ limit: 100 \}\)/);
});

test("갤러리 게시물 조회는 offset 기반 다음 페이지를 지원한다", () => {
  assert.match(queries, /offset = options\?\.offset \?\? 0/);
  assert.match(queries, /LIMIT \$1 OFFSET \$2/);
});

test("관리자 갤러리 더보기는 게시물만 추가로 가져온다", () => {
  assert.match(galleryRoute, /postsOnly/);
  assert.match(galleryRoute, /getCachedAdminGalleryPostsPagePayload\(\{ limit, offset \}\)/);
  assert.match(galleryClient, /postsOnly:\s*"1"/);
  assert.match(galleryClient, /offset:\s*String\(pagination\.nextOffset\)/);
  assert.doesNotMatch(galleryClient, /setVisiblePostCount/);
});
