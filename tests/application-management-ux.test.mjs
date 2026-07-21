import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const adminAction = readFileSync(new URL("../src/app/actions/admin.ts", import.meta.url), "utf8");
const trialClient = readFileSync(new URL("../src/app/admin/trial/TrialCrmClient.tsx", import.meta.url), "utf8");
const trialModals = readFileSync(new URL("../src/app/admin/trial/TrialCrmModals.tsx", import.meta.url), "utf8");
const applyClient = readFileSync(new URL("../src/app/admin/apply/ApplyAdminClient.tsx", import.meta.url), "utf8");
const applyModals = readFileSync(new URL("../src/app/admin/apply/ApplyAdminModals.tsx", import.meta.url), "utf8");
const adminShell = readFileSync(new URL("../src/app/admin/AdminShellClient.tsx", import.meta.url), "utf8");
const adminReadPayloads = readFileSync(new URL("../src/lib/adminReadPayloads.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("../src/lib/queries.ts", import.meta.url), "utf8");
const contactActions = readFileSync(new URL("../src/lib/application-contact-actions.ts", import.meta.url), "utf8");

test("체험 신청 목록과 상세 모달은 접수/희망/확정 일정을 분리해서 보여주고 취소 상태를 보존한다", () => {
  assert.match(trialClient, /function getTrialScheduleItems/);
  assert.match(trialClient, /label:\s*"신청일"/);
  assert.match(trialClient, /label:\s*"체험일"/);
  assert.match(trialClient, /label:\s*"수업교시"/);
  assert.match(trialClient, /label:\s*"확정일정"/);
  assert.match(trialClient, /function TrialLeadDetailModal/);
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
  assert.match(trialModals, /label="확정 수업"/);
  assert.match(trialModals, /label="확정 날짜 \*"/);
  assert.match(trialModals, /label="확정 시간 \*"/);
  assert.match(trialModals, /scheduledClassId/);
  assert.match(trialModals, /status:\s*"CANCELLED"/);
  assert.match(adminAction, /"childSchool",\s*"basketballExp"/);
  assert.match(adminAction, /"preferredDay",\s*"preferredPeriod"/);
  assert.match(adminAction, /"trialDate",\s*"trialFeeConfirmed"/);
});

test("체험 신청 일정은 DB 수업 정보와 연결해 실제 수업 시간을 표시한다", () => {
  assert.match(adminReadPayloads, /getCachedAdminTrialPayload/);
  assert.match(adminReadPayloads, /getClasses\(\)/);
  assert.match(adminReadPayloads, /classes,/);
  assert.match(adminReadPayloads, /admin-trial-v3/);
  assert.match(adminReadPayloads, /"admin-classes"/);
  assert.match(applyClient, /initialTrialClasses/);
  assert.match(trialClient, /interface ClassInfo/);
  assert.match(trialClient, /classesBySlotKey/);
  assert.match(trialClient, /classesById/);
  assert.match(trialClient, /function formatClassLabel/);
  assert.match(trialClient, /function formatConfirmedSchedule/);
  assert.match(trialClient, /formatCompactDate\(lead\.scheduledDate\).*formatClassLabel\(matchedClass\)/s);
  assert.match(trialClient, /function isLikelyDefaultScheduleTime/);
  assert.match(trialClient, /시간 확인 필요/);
  assert.match(trialClient, /const DAY_CODE_BY_LABEL/);
  assert.match(trialClient, /function normalizeSlotKey/);
  assert.match(trialClient, /function getPreferredSlotKeyCandidates/);
  assert.match(trialClient, /function getPreferredClass/);
  assert.match(trialModals, /function isLikelyDefaultScheduleTime/);
  assert.match(trialModals, /function normalizeSlotKey/);
  assert.match(trialModals, /function getPreferredSlotKeyCandidates/);
  assert.match(trialModals, /getPreferredClass\(lead, classes\)/);
});

test("체험 신청은 한 줄 목록에서 핵심 정보와 빠른 처리만 보여준다", () => {
  assert.match(trialClient, /function renderTrialList\(\)/);
  assert.match(trialClient, /<table className="w-full min-w-\[1260px\] table-fixed/);
  assert.match(trialClient, /상태[\s\S]*신청일[\s\S]*체험일[\s\S]*수업[\s\S]*수강생이름[\s\S]*학교[\s\S]*학년[\s\S]*상태변경[\s\S]*액션/);
  assert.match(trialClient, /setShowDetailModal\(lead\)/);
  assert.match(trialClient, /setOpenQuickActionId/);
  assert.match(trialClient, /LIST_ACTION_TRIGGER_CLASS/);
  assert.match(trialClient, /LIST_ACTION_MENU_CLASS/);
  assert.match(trialClient, /flash_on/);
  assert.match(trialClient, /function renderStatusChangeCell/);
  assert.match(trialClient, /renderEnrollGuideButton\(lead, "inline"\)/);
  assert.match(trialClient, /lead\.coachNoticeSentAt \? "쌤알림 재발송" : "쌤알림 발송"/);
  assert.match(trialClient, /void handleSendCoachNotice\(lead\)/);
  assert.match(trialClient, /type TrialDateFilter/);
  assert.match(trialClient, /const TRIAL_DATE_FILTERS/);
  assert.match(trialClient, /matchesTrialDateFilter\(lead, dateFilter\)/);
  assert.match(trialClient, /aTrialDate - bTrialDate/);
  assert.match(trialClient, /value=\{dateFilter\}/);
  assert.doesNotMatch(trialClient, /<th className="px-3 py-2(?:\.5)?">보호자<\/th>/);
  assert.doesNotMatch(trialClient, /<th className="px-3 py-2(?:\.5)?">쌤알림<\/th>/);
  assert.match(trialClient, /setShowScheduleModal\(lead\)/);
  assert.match(trialClient, /handleRecordContact\(lead, "CONTACTED"\)/);
  assert.doesNotMatch(trialClient, /viewMode/);
  assert.doesNotMatch(trialClient, /setViewMode/);
  assert.doesNotMatch(trialClient, /grid_view/);
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

test("신청 수정, 일정 변경, 취소는 운영 이력으로 남고 관리자 화면에 읽기 쉬운 라벨로 표시된다", () => {
  assert.match(contactActions, /"UPDATED"/);
  assert.match(contactActions, /"SCHEDULED"/);
  assert.match(contactActions, /"CANCELLED"/);
  assert.match(adminAction, /function recordApplicationHistoryLog/);
  assert.match(adminAction, /action:\s*"UPDATED"/);
  assert.match(adminAction, /action:\s*"CANCELLED"/);
  assert.match(trialModals, /action:\s*"UPDATED"/);
  assert.match(trialModals, /action:\s*"SCHEDULED"/);
  assert.match(trialModals, /action:\s*"CANCELLED"/);
  assert.match(applyClient, /UPDATED:\s*"내용 수정"/);
  assert.match(applyClient, /CANCELLED:\s*"취소 처리"/);
  assert.match(applyModals, /최근 운영 이력/);
  assert.match(applyModals, /원생 상세 열기/);
});

test("관리자 신청 화면은 핵심 메뉴와 주요 액션만 먼저 보여준다", () => {
  assert.match(adminShell, /label="신청 관리"/);
  assert.match(adminShell, /label="수납\/청구"/);
  assert.match(adminShell, /기타 운영/);
  assert.doesNotMatch(adminShell, /label="체험\/수강신청 관리"/);
  assert.match(applyClient, /학생, 보호자, 전화번호로 검색/);
  assert.match(applyClient, /<select\s+value=\{filter\}/);
  assert.match(applyClient, /LIST_ACTION_TRIGGER_CLASS/);
  assert.match(applyClient, /LIST_ACTION_MENU_CLASS/);
  assert.match(applyClient, /setShowDetailModal\(app\)/);
  assert.match(applyClient, /학생\/연락처/);
  assert.match(applyClient, /액션/);
  assert.doesNotMatch(applyClient, /LIST_QUICK_ACTION_CLASS/);
  assert.doesNotMatch(applyClient, /<th className="px-3 py-2(?:\.5)?">보호자<\/th>/);
  assert.doesNotMatch(applyClient, /COMPACT_CARD_ACTION_CLASS/);
  assert.doesNotMatch(applyClient, /COMPACT_CARD_CHIP_CLASS/);
  assert.doesNotMatch(applyClient, /className="rounded-lg border border-gray-200 bg-white p-3/);
  assert.doesNotMatch(applyClient, /mt-3 grid gap-2 sm:grid-cols-2/);
  assert.doesNotMatch(applyClient, /workFlags\.map/);
});

test("체험수업과 수강신청은 카드형을 폐기하고 목록형만 제공한다", () => {
  assert.match(applyClient, /renderApplicationList/);
  assert.match(applyClient, /LIST_ACTION_TRIGGER_CLASS/);
  assert.match(applyClient, /\{renderApplicationList\(\)\}/);
  assert.doesNotMatch(applyClient, /type ViewMode/);
  assert.doesNotMatch(applyClient, /setViewMode/);
  assert.doesNotMatch(applyClient, /grid_view/);
  assert.match(trialClient, /renderTrialList/);
  assert.match(trialClient, /LIST_ACTION_TRIGGER_CLASS/);
  assert.match(trialClient, /\{renderTrialList\(\)\}/);
  assert.doesNotMatch(trialClient, /type ViewMode/);
  assert.doesNotMatch(trialClient, /setViewMode/);
  assert.doesNotMatch(trialClient, /grid_view/);
  assert.match(trialClient, /handleStatusChange\(lead, event\.target\.value\)/);
});

test("목록형은 스프레드시트처럼 실제 테이블 구조로 보여준다", () => {
  assert.match(trialClient, /function renderTrialList\(\)[\s\S]*<table className="w-full min-w-\[1260px\]/);
  assert.match(trialClient, /<thead[\s\S]*상태[\s\S]*신청일[\s\S]*체험일[\s\S]*수업[\s\S]*수강생이름[\s\S]*학교[\s\S]*학년[\s\S]*상태변경[\s\S]*액션/);
  assert.match(trialClient, /<tbody[\s\S]*visibleLeads\.map/);
  assert.doesNotMatch(trialClient, /hidden grid-cols-\[1fr_0\.9fr_2\.2fr_0\.8fr_1\.2fr\]/);
  assert.match(applyClient, /function renderApplicationList\(\)[\s\S]*<table className="w-full min-w-\[960px\]/);
  assert.match(applyClient, /<thead[\s\S]*학생\/연락처[\s\S]*신청\/희망수업[\s\S]*수강\/셔틀[\s\S]*액션/);
  assert.match(applyClient, /<tbody[\s\S]*visibleApps\.map/);
  assert.doesNotMatch(applyClient, /hidden grid-cols-\[1\.1fr_1fr_1\.3fr_0\.9fr_1\.2fr\]/);
});
