import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const adminClient = readFileSync(
  new URL("../src/app/admin/seasonal/SeasonalAdminClient.tsx", import.meta.url),
  "utf8",
);
const adminRoute = readFileSync(
  new URL("../src/app/api/admin/seasonal/route.ts", import.meta.url),
  "utf8",
);

test("방학특강 신청 상세는 셔틀 요청 세부 정보를 버리지 않고 보여준다", () => {
  assert.match(adminRoute, /shuttleRequest:\s*true/);
  assert.match(adminClient, /shuttleRequest:\s*\(item\.shuttleRequest \?\? null\)/);
  assert.match(adminClient, /function ShuttleRequestBox/);
  assert.match(adminClient, /탑승 위치/);
  assert.match(adminClient, /하차 위치/);
  assert.match(adminClient, /희망 시간/);
});

test("방학특강 신청 상세는 관리자 빠른 처리 버튼과 필수 신청 정보를 제공한다", () => {
  assert.match(adminClient, /const quickStatuses: ItemStatus\[\] = \["APPROVED", "WAITLISTED", "REJECTED", "CANCELLED"\]/);
  assert.match(adminClient, /formatDateTime\(application\.createdAt\)/);
  assert.match(adminClient, /application\.address/);
  assert.match(adminClient, /application\.processedNote/);
  assert.match(adminClient, /대기 \{item\.waitlistOrder\}번/);
});

test("방학특강 신청 상세는 수강·청구 전환 준비 상태를 확인할 수 있다", () => {
  assert.match(adminRoute, /linkedProgramId:\s*true/);
  assert.match(adminRoute, /linkedClassId:\s*true/);
  assert.match(adminClient, /linkedClassId:\s*item\.linkedClassId \?\? offering\?\.linkedClassId \?\? null/);
  assert.match(adminClient, /function ConversionReadinessBox/);
  assert.match(adminClient, /정규 반 연결 필요/);
  assert.match(adminClient, /전환 준비됨/);
  assert.match(adminClient, /수강·청구 연결 완료/);
});
