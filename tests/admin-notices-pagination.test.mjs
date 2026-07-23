import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const adminReadPayloads = readFileSync(new URL("../src/lib/adminReadPayloads.ts", import.meta.url), "utf8");
const noticesRoute = readFileSync(new URL("../src/app/api/admin/notices/route.ts", import.meta.url), "utf8");
const noticesClient = readFileSync(new URL("../src/app/admin/notices/NoticesAdminClient.tsx", import.meta.url), "utf8");
const queries = readFileSync(new URL("../src/lib/queries.ts", import.meta.url), "utf8");

test("관리자 공지사항은 첫 화면 조회 수를 30건으로 제한한다", () => {
  assert.match(adminReadPayloads, /const ADMIN_NOTICES_PAGE_SIZE = 30/);
  assert.doesNotMatch(adminReadPayloads, /getNotices\(\{ limit: 100 \}\)/);
});

test("공지사항 조회는 offset 기반 다음 페이지를 지원한다", () => {
  assert.match(queries, /offset = options\?\.offset \?\? 0/);
  assert.match(queries, /LIMIT \$1 OFFSET \$2/);
});

test("관리자 공지사항 더보기는 공지 목록만 추가로 가져온다", () => {
  assert.match(noticesRoute, /noticesOnly/);
  assert.match(noticesRoute, /getCachedAdminNoticesPagePayload\(\{ limit, offset \}\)/);
  assert.match(noticesClient, /noticesOnly:\s*"1"/);
  assert.match(noticesClient, /offset:\s*String\(pagination\.nextOffset\)/);
  assert.match(noticesClient, /setNotices\(prev =>/);
});
