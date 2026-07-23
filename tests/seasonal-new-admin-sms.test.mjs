import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("src/lib/seasonal/service.ts", "utf8");

test("특강 최초 신청은 관리자 문자 트리거와 필요한 변수를 사용한다", () => {
  assert.match(service, /adminTrigger: "SPECIAL_APPLICATION_NEW_ADMIN"/);
  assert.match(service, /notifyCoaches: false/);
  for (const variable of ["childName", "seasonTitle", "offeringTitle", "parentName", "parentPhone"]) {
    assert.match(service, new RegExp(`${variable}[,:]`));
  }
});

test("관리자 최초 신청 문자는 신청 ID 기반의 안정적인 eventId로 중복을 막는다", () => {
  assert.match(service, /eventId: `seasonal-application:\$\{application\.id\}:new-admin`/);
  assert.match(service, /notifyAdminsOfNewSeasonalApplication\(application, seasonTitle\)/);
  assert.match(service, /notifyAdminsOfNewSeasonalApplication\(created, season\.title\)/);
});

test("관리자 문자는 학부모 접수문자 발송 결과와 독립적으로 실행된다", () => {
  const newApplicationDispatch = service.slice(
    service.indexOf("const [notification] = await Promise.all([", service.indexOf("const created = committed.application")),
    service.indexOf("return {", service.indexOf("const created = committed.application")),
  );
  assert.match(newApplicationDispatch, /dispatchSeasonalParentSms/);
  assert.match(newApplicationDispatch, /notifyAdminsOfNewSeasonalApplication/);
});
