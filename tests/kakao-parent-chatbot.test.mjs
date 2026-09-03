import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyParentUtterance, getKakaoRequestId, getKakaoUserKey } from "../src/lib/kakao-chatbot-contract.ts";

test("학부모 자연어를 주요 요청 종류로 분류한다", () => {
  const cases = [
    ["지유 오늘 결석할게요", "REGULAR_ABSENCE"],
    ["오늘 하원 셔틀은 안 타요", "SHUTTLE_SKIP"],
    ["오늘 다른 곳에서 차 탈게요", "SHUTTLE_LOCATION"],
    ["다음 달부터 휴원할게요", "PAUSE"],
    ["화요일반으로 옮기고 싶어요", "CLASS_CHANGE"],
    ["입금했어요", "PAYMENT_CONFIRM"],
    ["현금영수증 부탁드려요", "RECEIPT"],
    ["원장님과 상담하고 싶어요", "HUMAN"],
  ];
  for (const [source, expected] of cases) assert.equal(classifyParentUtterance(source), expected, source);
});

test("카카오 공식 payload의 채널 키를 우선 사용한다", () => {
  assert.equal(getKakaoUserKey({ userRequest: { user: { id: "bot", properties: { plusfriendUserKey: "channel" } } } }), "channel");
  assert.equal(getKakaoUserKey({ userRequest: { user: { id: "bot", properties: {} } } }), "bot");
});

test("카카오 요청 식별자는 헤더를 우선하고 비정상 길이는 거부한다", () => {
  assert.equal(getKakaoRequestId({ userRequest: { requestId: "payload-1" } }, "header-1"), "header-1");
  assert.equal(getKakaoRequestId({ userRequest: { requestId: "payload-1" } }), "payload-1");
  assert.equal(getKakaoRequestId({ userRequest: { requestId: "x".repeat(201) } }), null);
});

test("카카오 키 원문 비저장과 승인 경계를 유지한다", async () => {
  const source = await readFile("src/lib/kakao-parent-chatbot.ts", "utf8");
  const route = await readFile("src/app/api/kakao/chatbot/skill/route.ts", "utf8");
  const migration = await readFile("prisma/migrations/20260831110000_add_kakao_parent_identity/migration.sql", "utf8");
  assert.match(source, /createHmac\("sha256"/);
  assert.doesNotMatch(migration, /userKey\" TEXT/);
  assert.match(source, /status='SUBMITTED'/);
  assert.match(source, /"studentId" IS NOT NULL/);
  assert.match(source, /다시 말할게요/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /providerRequestId/);
  assert.match(source, /!draft && CONFIRM_WORDS\.test\(text\)/);
  assert.match(source, /이미 접수됐거나 현재 확인할 요청이 없어요/);
  assert.match(source, /"lastSeenAt"=now\(\)/);
  assert.doesNotMatch(source, /status='APPLIED'.*UPDATE/s);
  assert.match(route, /x-stiz-kakao-skill-secret/);
  assert.doesNotMatch(route, /Promise\.race/);
  assert.match(route, /시작한 쓰기를 시간 제한 경주로 버리지 않는다/);
  assert.match(source, /15 \* 60_000/);
});

test("검증이 끝난 전용 업무는 기존 학부모 화면으로 바로 연결한다", async () => {
  const source = await readFile("src/lib/kakao-parent-chatbot.ts", "utf8");
  for (const path of [
    "/mypage/regular-absence",
    "/mypage/seasonal",
    "/mypage/makeup",
    "/mypage/shuttle",
    "/mypage/payments",
    "/mypage/enrollment-change",
  ]) assert.match(source, new RegExp(path.replaceAll("/", "\\/")));
  assert.match(source, /기사님 운행 화면에 바로 표시/);
  assert.match(source, /최초 인증 때 연결한 학부모 계정/);
  assert.match(source, /DIRECT_KIND_LINKS\[kind\]/);
});

test("인증 보호자는 연결 자녀만으로 안전한 표시명을 만든다", async () => {
  const source = await readFile("src/lib/kakao-parent-chatbot.ts", "utf8");
  assert.match(source, /export function formatKakaoParentDisplayName/);
  assert.match(source, /return `\$\{names\[0\]\} 학생 학부모님`/);
  assert.match(source, /return `\$\{names\.join\("·"\)\} 학생 보호자`/);
  assert.match(source, /formatKakaoParentDisplayName\(children\)/);
  assert.match(source, /WHERE "parentId"=\$1 AND "mergedIntoStudentId" IS NULL/);
  assert.doesNotMatch(source, /SELECT[^`]*(?:phone|"User"|parent\.name)/i);
});
