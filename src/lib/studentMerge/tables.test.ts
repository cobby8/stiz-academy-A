import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// @ts-expect-error -- Node's type-stripping runner needs the runtime extension.
import { autoMovableTables, followsParentRows, JSON_STUDENT_REF, STUDENT_REF_TABLES, type StudentRefTable } from "./tables.ts";

// 병합 엔진이 옮기는 "학생 참조 목록"이 실제 스키마를 따라가고 있는지 지키는 가드.
// 2026-07-26 목록(28곳) 뒤에 생긴 테이블들이 빠져 있던 사고를 되풀이하지 않기 위해 만들었다.

const key = (t: { table: string; column: string }) => `${t.table}.${t.column}`;
const listed = new Set(STUDENT_REF_TABLES.map(key));

/**
 * 2026-10-02 운영 DB 실측(information_schema.columns + pg_constraint)에서 학생 id 를 들고 있던 컬럼.
 * 이름·전화번호 스냅샷, studentKey(시트 원본 키), StudentMergeLog, Student.mergedIntoStudentId 는 제외.
 */
const PROD_2026_10_02 = [
  "Attendance.studentId", "Enrollment.studentId", "EnrollmentApplication.convertedStudentId",
  "EnrollmentChangeRequest.studentId", "Feedback.studentId", "Guardian.studentId",
  "KakaoParentIntake.studentId", "MakeupCredit.studentId", "MakeupSession.studentId",
  "MediaRevocationJob.studentId", "NotificationDelivery.studentId", "OperationsCommand.studentId",
  "ParentOperationsRequestLink.studentId", "ParentRequest.studentId", "Payment.studentId",
  "PaymentInvoice.studentId", "PaymentParentRequest.studentId", "PaymentTransaction.studentId",
  "PosPaymentNotice.resolvedStudentId", "RallyzAttendanceSyncItem.studentId", "RegularAbsence.studentId",
  "RegularShuttleStop.studentId", "SeasonalShuttleRoster.studentIdSnapshot", "ShuttleDayException.studentId",
  "ShuttleRoutePassenger.studentId", "SkillRecord.studentId", "SpecialProgramApplication.convertedStudentId",
  "SpecialProgramEnrollmentDate.studentId", "SpecialProgramMakeup.studentId",
  "StaffPaymentConfirmationRequest.studentId", "StudentMediaConsent.studentId",
  "StudentRegistrationLedger.studentId", "StudentSessionNote.studentId", "StudentSheetRawRow.studentId",
  "StudentShuttleLocation.studentId", "StudentShuttleRide.studentId", "StudentTeamRosterEntry.studentId",
  "TrialLead.convertedStudentId", "Waitlist.studentId",
];

test("2026-10-02 운영 DB 실측의 학생 참조 컬럼이 전부 목록에 있다", () => {
  const missing = PROD_2026_10_02.filter((k) => !listed.has(k));
  assert.deepEqual(missing, [], `병합 목록에 없는 학생 참조: ${missing.join(", ")}`);
});

test("schema.prisma 에 학생 id 필드가 새로 생기면 목록에도 있어야 한다", () => {
  const schema = readFileSync(path.join(import.meta.dirname, "../../../prisma/schema.prisma"), "utf8");
  // 학생 id 를 옮기는 대상이 아닌 것(자기 참조 병합 표시, JSON 배열 컬럼)은 따로 다룬다.
  const notMoved = new Set(["Student.mergedIntoStudentId", key(JSON_STUDENT_REF)]);

  const found: string[] = [];
  let model = "";
  for (const line of schema.split(/\r?\n/)) {
    const m = /^model\s+(\w+)\s*\{/.exec(line);
    if (m) {
      model = m[1];
      continue;
    }
    if (/^\}/.test(line)) {
      model = "";
      continue;
    }
    const field = /^\s+(\w*[sS]tudentId\w*)\s+String/.exec(line);
    if (model && field) found.push(`${model}.${field[1]}`);
  }

  assert.ok(found.length >= 30, `스키마 파싱이 이상하다(학생 id 필드 ${found.length}개)`);
  const missing = found.filter((k) => !listed.has(k) && !notMoved.has(k));
  assert.deepEqual(
    missing,
    [],
    `병합 엔진이 모르는 학생 id 필드: ${missing.join(", ")} — src/lib/studentMerge/tables.ts 에 추가하라`,
  );
});

test("목록에 같은 컬럼이 두 번 들어가 있지 않다", () => {
  assert.equal(listed.size, STUDENT_REF_TABLES.length);
});

test("청구 계열은 별도 처리·Payment 연쇄·남기기 고정·부모 따라가기 중 하나로 반드시 보호된다", () => {
  const unguarded = STUDENT_REF_TABLES.filter(
    (t: StudentRefTable) =>
      t.billingScoped &&
      !t.handledSeparately &&
      !t.cascadesFromPayment &&
      !t.keepOnLoser &&
      !followsParentRows(t),
  ).map(key);
  assert.deepEqual(unguarded, [], "동결월 청구를 그냥 옮겨 버릴 수 있는 청구 계열 테이블");
});

test("부모 따라가기의 부모는 먼저 옮겨지는 테이블이다(부모끼리 꼬리를 물지 않는다)", () => {
  const byTable = new Map<string, StudentRefTable>(
    STUDENT_REF_TABLES.map((t: StudentRefTable) => [t.table, t]),
  );
  for (const t of STUDENT_REF_TABLES.filter(followsParentRows)) {
    for (const p of t.followsParents ?? []) {
      const parent = byTable.get(p.parentTable);
      assert.ok(parent, `${t.table} 의 부모 ${p.parentTable} 이(가) 목록에 없다`);
      assert.equal(parent.column, "studentId", `${p.parentTable} 의 학생 컬럼은 studentId 여야 한다`);
      assert.equal(followsParentRows(parent), false, `${p.parentTable} 도 부모를 따라가면 순서가 꼬인다`);
    }
  }
});

test("엔진이 자동으로 옮기는 목록에 청구 본체(Payment·청구서·거래)는 없다", () => {
  const auto = new Set(autoMovableTables().map((t: StudentRefTable) => t.table));
  for (const name of ["Payment", "PaymentInvoice", "PaymentTransaction", "StaffPaymentConfirmationRequest", "Enrollment"]) {
    assert.equal(auto.has(name), false, `${name} 은(는) 별도 로직으로만 옮긴다`);
  }
  for (const name of ["MakeupCredit", "RegularAbsence", "ShuttleDayException", "PaymentParentRequest", "PosPaymentNotice"]) {
    assert.equal(auto.has(name), true, `${name} 이(가) 병합 대상에서 빠졌다`);
  }
});
