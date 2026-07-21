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

test("방학특강 신청 목록은 복수 선택과 일괄 상태 변경을 제공한다", () => {
  assert.match(adminClient, /selectedItemIds/);
  assert.match(adminClient, /BULK_ITEM_STATUSES/);
  assert.match(adminClient, /현재 목록 전체 선택/);
  assert.match(adminClient, /선택한 신청 반 \{selectedItemCount\}개/);
  assert.match(adminClient, /handleBulkItemStatus/);
  assert.match(adminClient, /resource: "bulkItems"/);
});

test("방학특강 일괄 처리는 단건 항목 처리 안전장치를 재사용한다", () => {
  assert.match(adminRoute, /body\.resource === "bulkItems"/);
  assert.match(adminRoute, /parseBulkItemIds/);
  assert.match(adminRoute, /updateSpecialProgramItemStatus/);
  assert.match(adminRoute, /Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(adminRoute, /BULK_LIMIT_EXCEEDED/);
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

test("방학특강 승인 항목은 관리자 액션으로 수강 등록과 청구서를 생성한다", () => {
  assert.match(adminRoute, /resource === "conversion"/);
  assert.match(adminRoute, /convertApprovedItemToEnrollmentAndInvoice/);
  assert.match(adminRoute, /ensureInvoiceForPayment\(converted\.paymentId\)/);
  assert.match(adminRoute, /INSERT INTO "Enrollment"/);
  assert.match(adminRoute, /INSERT INTO "Payment"/);
  assert.match(adminRoute, /ITEM_CONVERTED_TO_ENROLLMENT_PAYMENT/);
  assert.match(adminClient, /resource: "conversion"/);
  assert.match(adminClient, /수강·청구 생성/);
});

test("방학특강 전환 후 관리자 상세에서 청구서를 열고 링크를 복사할 수 있다", () => {
  assert.match(adminRoute, /paymentInvoice\.findMany/);
  assert.match(adminRoute, /invoice:\s*item\.paymentId \? invoicesByPaymentId\.get\(item\.paymentId\) \?\? null : null/);
  assert.match(adminClient, /function getItemInvoiceHref/);
  assert.match(adminClient, /function InvoiceActionBox/);
  assert.match(adminClient, /청구서 열기/);
  assert.match(adminClient, /링크 복사/);
  assert.match(adminClient, /navigator\.clipboard\.writeText/);
});

test("방학특강 가져오기 신청은 운영 검토 정보를 개인정보와 분리해 보여준다", () => {
  assert.match(adminClient, /function ApplicationReviewSummary/);
  assert.match(adminClient, /applicantTypeLabel/);
  assert.match(adminClient, /selectedWeekdays/);
  assert.match(adminClient, /원본 가져오기/);
  assert.match(adminClient, /확인 필요/);
  assert.match(adminClient, /paymentReviewLabel/);
  assert.match(adminClient, /결제 확인 전/);
});

test("이전 API 응답에도 신청 검토 UI가 기본값으로 동작한다", () => {
  assert.match(adminClient, /application\.applicantType \?\? application\.memberType \?\? application\.customerType/);
  assert.match(adminClient, /application\.selectedWeekdays \?\? application\.weekdays \?\? application\.selectedDays/);
  assert.match(adminClient, /application\.imported \?\? application\.isImported \?\? importSource/);
  assert.match(adminClient, /reviewReasons = stringList/);
  assert.match(adminClient, /요일 미확인/);
  assert.match(adminClient, /구분 미확인/);
});

test("특강 반은 회원 유형별 가격과 미확정 정원을 입력할 수 있다", () => {
  assert.match(adminClient, /name:"newApplicantPrice"/);
  assert.match(adminClient, /name:"existingApplicantPrice"/);
  assert.match(adminClient, /capacity: capacity \? Number\(capacity\) : null/);
  assert.match(adminClient, /정원이 없는 반은 DRAFT 상태로만 저장/);
  assert.match(adminClient, /status: "DRAFT"/);
});

test("확인 필요 항목은 관리자 검토 완료 액션을 제공한다", () => {
  assert.match(adminClient, /resource: "applicationReview"/);
  assert.match(adminClient, /action: "CLEAR", reviewNote/);
  assert.match(adminClient, /onResolveReview\(application\.id, reviewNote\.trim\(\)\)/);
  assert.match(adminClient, /disabled=\{resolving \|\| !reviewNote\.trim\(\)\}/);
  assert.doesNotMatch(adminClient, /resolved: true/);
  assert.match(adminClient, /검토 완료/);
  assert.match(adminClient, /검토 완료 처리에 실패했습니다/);
});
