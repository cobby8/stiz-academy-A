import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/lib/shuttle/parent.ts", "utf8");
const page = fs.readFileSync("src/app/mypage/page.tsx", "utf8");

test("학부모 셔틀 조회는 인증된 앱 계정의 자녀 ID로만 범위를 제한한다", () => {
  assert.match(page, /requireVerifiedParent\(\)/);
  assert.match(page, /getParentShuttleOverview\(parentAuth\.appUserId\)/);
  assert.match(source, /where:\s*\{\s*parentId:\s*appUserId\s*\}/);
  assert.match(source, /studentId:\s*\{\s*in:\s*studentIds\s*\}/);
  assert.match(source, /convertedStudentId:\s*\{\s*in:\s*studentIds\s*\}/);
  assert.doesNotMatch(source, /parentPhone/);
});

test("회원 전환이 완료된 특강 신청만 조회한다", () => {
  assert.match(source, /applicationItem:\s*\{[\s\S]*?conversionStatus:\s*"COMPLETED"/);
  assert.match(source, /sourceType:\s*"SPECIAL_PROGRAM"/);
  assert.match(source, /sourceType:\s*"REGULAR_CLASS"/);
  assert.match(source, /status:\s*\{\s*notIn:\s*\["CANCELLED",\s*"REJECTED"\]\s*\}/);
});

test("보관 노선은 제외하고 초안 노선 상세는 숨긴다", () => {
  assert.match(source, /status:\s*\{\s*not:\s*"ARCHIVED"\s*\}/g);
  assert.match(source, /const isDraft = .*status === "DRAFT"/);
  assert.match(source, /routeName:\s*isDraft \? null/);
  assert.match(source, /stopAddress:\s*isDraft \? null/);
  assert.match(source, /vehicleName:\s*isDraft \? null/);
  assert.match(source, /rideStatus:\s*isDraft \? null/);
});

test("특강 운행을 한 건으로 축약하지 않고 routeKey별 최신 버전을 각각 표시한다", () => {
  assert.match(source, /specialRequests\.flatMap/);
  assert.match(source, /activeByRoute/);
  assert.match(source, /preferRouteVersion/);
  assert.match(source, /currentIsOperational/);
  assert.match(source, /candidateIsOperational/);
  assert.doesNotMatch(source, /\]\s*\[0\]/);
});

test("정규 셔틀 미배정 신청도 본인 계정 또는 본인 학생 연결 범위에서만 표시한다", () => {
  assert.match(source, /FROM "EnrollmentApplication"/);
  assert.match(source, /"shuttleNeeded" = true/);
  assert.match(source, /"parentUserId" = \$1/);
  assert.match(source, /"convertedStudentId" = ANY\(\$2::text\[\]\)/);
  assert.match(source, /status IN \('PENDING', 'APPROVED'\)/);
  assert.match(source, /assignedClassKeys/);
  assert.match(source, /application\.convertedStudentId\s*\?\s*\(studentIds\.includes/);
});

test("민감하거나 불필요한 운행 정보는 select하지 않는다", () => {
  assert.doesNotMatch(source, /driver:\s*\{/);
  assert.doesNotMatch(source, /phone:\s*true/);
  assert.doesNotMatch(source, /latitude:\s*true/);
  assert.doesNotMatch(source, /longitude:\s*true/);
  assert.doesNotMatch(source, /stops:\s*\{/);
  assert.match(source, /stop:\s*\{\s*select:/);
});
