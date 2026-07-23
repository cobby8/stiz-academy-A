import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const adminReadPayloads = readFileSync(new URL("../src/lib/adminReadPayloads.ts", import.meta.url), "utf8");
const studentsPage = readFileSync(new URL("../src/app/admin/students/page.tsx", import.meta.url), "utf8");
const studentsClient = readFileSync(new URL("../src/app/admin/students/StudentManagementClient.tsx", import.meta.url), "utf8");
const importSummaryRoute = readFileSync(new URL("../src/app/api/admin/students/import-summary/route.ts", import.meta.url), "utf8");

test("관리자 원생 첫 payload는 시트 이관 요약을 함께 조회하지 않는다", () => {
  const payloadStart = adminReadPayloads.indexOf("export function getCachedAdminStudentsPayload");
  const payloadEnd = adminReadPayloads.indexOf("export const getCachedAdminStudentImportSummaryPayload");
  const payloadSource = adminReadPayloads.slice(payloadStart, payloadEnd);

  assert.doesNotMatch(payloadSource, /getStudentSheetImportSummary\(\)/);
  assert.doesNotMatch(studentsPage, /sheetImportSummary=\{sheetImportSummary\}/);
});

test("시트 이관 요약은 별도 API와 버튼으로 지연 로딩한다", () => {
  assert.match(adminReadPayloads, /getCachedAdminStudentImportSummaryPayload/);
  assert.match(importSummaryRoute, /getCachedAdminStudentImportSummaryPayload/);
  assert.match(studentsClient, /\/api\/admin\/students\/import-summary/);
  assert.match(studentsClient, /점검 불러오기/);
  assert.match(studentsClient, /setShowImportTools\(true\)/);
});
