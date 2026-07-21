import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const adminAction = readFileSync(new URL("../src/app/actions/admin.ts", import.meta.url), "utf8");
const trialClient = readFileSync(new URL("../src/app/admin/trial/TrialCrmClient.tsx", import.meta.url), "utf8");
const trialModals = readFileSync(new URL("../src/app/admin/trial/TrialCrmModals.tsx", import.meta.url), "utf8");
const applyClient = readFileSync(new URL("../src/app/admin/apply/ApplyAdminClient.tsx", import.meta.url), "utf8");
const applyModals = readFileSync(new URL("../src/app/admin/apply/ApplyAdminModals.tsx", import.meta.url), "utf8");
const queries = readFileSync(new URL("../src/lib/queries.ts", import.meta.url), "utf8");

test("체험 신청 카드는 접수/희망/확정 일정을 분리해서 보여주고 취소 상태를 보존한다", () => {
  assert.match(trialClient, /function getTrialScheduleItems/);
  assert.match(trialClient, /label:\s*"접수"/);
  assert.match(trialClient, /label:\s*"희망일"/);
  assert.match(trialClient, /label:\s*"희망시간"/);
  assert.match(trialClient, /label:\s*"확정일"/);
  assert.match(trialClient, /CLOSED_TRIAL_STATUSES = new Set\(\["CONVERTED", "LOST", "CANCELLED"\]\)/);
  assert.match(trialClient, /CANCELLED:\s*\{\s*label:\s*"취소"/);
  assert.match(queries, /CANCELLED:\s*statusMap\["CANCELLED"\]/);
});

test("체험 신청은 수정, 일정 변경, 취소 모달로 관리할 수 있다", () => {
  assert.match(trialClient, /setShowEditModal/);
  assert.match(trialClient, /setShowScheduleModal/);
  assert.match(trialClient, /setShowCancelModal/);
  assert.match(trialModals, /function TrialEditModal/);
  assert.match(trialModals, /function TrialScheduleModal/);
  assert.match(trialModals, /function TrialCancelModal/);
  assert.match(trialModals, /status:\s*"CANCELLED"/);
  assert.match(adminAction, /"childSchool",\s*"basketballExp"/);
  assert.match(adminAction, /"preferredDay",\s*"preferredPeriod"/);
  assert.match(adminAction, /"trialDate",\s*"trialFeeConfirmed"/);
});

test("수강신청은 승인 전 내용 수정과 취소 이력 처리를 지원한다", () => {
  assert.match(adminAction, /export async function updateEnrollApplication/);
  assert.match(adminAction, /export async function cancelEnrollApplication/);
  assert.match(adminAction, /status = 'CANCELLED'/);
  assert.match(adminAction, /이미 승인된 신청서는 원생\/수강 등록 메뉴에서 수정/);
  assert.match(applyClient, /setShowEditModal/);
  assert.match(applyClient, /setShowCancelModal/);
  assert.match(applyModals, /function EditApplicationModal/);
  assert.match(applyModals, /function CancelApplicationModal/);
  assert.match(applyModals, /updateEnrollApplication/);
  assert.match(applyModals, /cancelEnrollApplication/);
});

test("수강신청 수정 모달은 신청 폼의 주요 입력 항목을 관리자용 이름으로 노출한다", () => {
  assert.match(applyModals, /아이 정보/);
  assert.match(applyModals, /보호자 정보/);
  assert.match(applyModals, /수강 정보/);
  assert.match(applyModals, /희망 시간/);
  assert.match(applyModals, /셔틀\/메모/);
  assert.match(applyModals, /applicationNoticeConfirmed/);
  assert.match(applyModals, /shuttleNoticeConfirmed/);
});
