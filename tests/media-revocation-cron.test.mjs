import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(
  new URL("../src/app/api/cron/media-revocations/route.ts", import.meta.url),
  "utf8",
);

test("미디어 또는 사진 삭제가 실패하면 cron 전체 성공을 false로 반환한다", () => {
  assert.match(
    routeSource,
    /result\.failed\s*===\s*0\s*&&\s*photoDeletion\.failed\s*===\s*0/,
  );
  assert.match(routeSource, /NextResponse\.json\(\{\s*success,/);
});
