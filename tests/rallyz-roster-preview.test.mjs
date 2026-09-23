import test from "node:test";
import assert from "node:assert/strict";
import { extractRallyzNonPaymentGrid, previewRallyzRoster } from "../src/lib/rallyz-roster-preview.mjs";

const headers = [
  "학생명", "관리용이름", "클래스명", "학생 휴대폰번호", "보호자1", "보호자1 휴대폰번호",
  "생년월일", "수강료", "주소",
];

test("결제 열을 접근하지 않고 학생과 반 배정을 분리해 미리 본다", () => {
  const row = ["테스트학생가", "가학생", "월3", "010-0000-0001", "보호자", "010-0000-0002", "20150101"];
  Object.defineProperty(row, 7, { get() { throw new Error("financial value was accessed"); } });
  Object.defineProperty(row, 8, { get() { throw new Error("unneeded personal data was accessed"); } });
  const result = previewRallyzRoster([headers, row], ["월3"], [
    { id: "site-a", name: "테스트학생가", branch: "2호점", birthDate: "2015-01-01", guardianPhones: ["010-0000-0002"], enrollments: [] },
  ]);

  assert.equal(result.rowCount, 1);
  assert.equal(result.studentCount, 1);
  assert.equal(result.enrollmentCount, 1);
  assert.equal(result.heldRowCount, 0);
  assert.equal(result.students[0].status, "READY_FOR_SITE_REVIEW");
  assert.deepEqual(result.students[0].enrollments[0].sourceRows, [2]);
  assert.equal(JSON.stringify(result).includes("수강료"), false);
  assert.equal(JSON.stringify(result).includes("20150101"), false);
  assert.equal(JSON.stringify(result).includes("010-0000"), false);
});

test("워크시트에서 허용된 신원·반 열만 읽는다", () => {
  const rows = [
    headers,
    ["테스트학생가", "가학생", "월3", "010-0000-0011", "보호자", "010-0000-0012", "20150101"],
  ];
  const grid = extractRallyzNonPaymentGrid(headers, rows.length, (row, column) => {
    if (column === 7 || column === 8) throw new Error("excluded worksheet cell was read");
    return rows[row][column] ?? "";
  });
  assert.equal(grid[1][0], "테스트학생가");
  assert.equal(grid[1][2], "월3");
  assert.equal(grid[1][7], "");
  assert.equal(grid[1][8], "");
});

test("유효하지 않은 날짜는 신원키로 쓰지 않고 보호자 전화 근거를 사용한다", () => {
  const result = previewRallyzRoster([
    headers,
    ["테스트학생바", "", "월3", "", "보호자", "010-0000-0007", "20150230", ""],
  ], ["월3"], [
    { id: "site-b", name: "테스트학생바", branch: "2호점", birthDate: null, guardianPhones: ["010-0000-0007"], enrollments: [] },
  ]);
  assert.equal(result.studentCount, 1);
  assert.equal(result.students[0].status, "READY_FOR_SITE_REVIEW");
  assert.equal(result.students[0].heldReasons.length, 0);
  assert.equal(JSON.stringify(result).includes("20150230"), false);
});

test("같은 학생의 다반 행을 한 학생으로 묶고 반을 각각 보존한다", () => {
  const result = previewRallyzRoster([
    headers,
    ["테스트학생나", "나학생", "월3", "", "보호자", "010-0000-0003", "20160101", "값1"],
    ["테스트학생나", "나학생", "수4", "", "보호자", "010-0000-0003", "20160101", "값2"],
  ], ["월3", "수4"], [
    { id: "site-c", name: "테스트학생나", branch: "2호점", birthDate: "2016-01-01", guardianPhones: ["010-0000-0003"], enrollments: [] },
  ]);

  assert.equal(result.studentCount, 1);
  assert.equal(result.enrollmentCount, 2);
  assert.deepEqual(result.students[0].enrollments.map((entry) => entry.className), ["월3", "수4"]);
  assert.equal(result.students[0].status, "READY_FOR_SITE_REVIEW");
});

test("사이트 학생은 정확한 이름과 연락처 또는 생년월일 근거로만 후보 매칭한다", () => {
  const siteStudents = [
    { id: "site-strong", name: "테스트학생하", branch: "2호점", birthDate: "2015-01-01", phone: null, parentPhone: null, guardianPhones: ["010-0000-0008"], enrollments: [{ classId: "class-1", className: "월3", status: "ACTIVE" }] },
    { id: "site-weak", name: "테스트학생하", branch: "2호점", birthDate: "2015-01-01", phone: null, parentPhone: null, guardianPhones: ["010-0000-0009"], enrollments: [] },
  ];
  const result = previewRallyzRoster([
    headers,
    ["테스트학생하", "", "월3", "", "", "010-0000-0008", "20150101", ""],
  ], ["월3"], siteStudents);

  assert.equal(result.students[0].siteMatch.status, "MATCHED_REVIEW");
  assert.equal(result.students[0].siteMatch.confidence, "STRONG_PHONE");
  assert.equal(result.students[0].siteMatch.siteStudentId, "site-strong");
  assert.equal(result.students[0].status, "READY_FOR_SITE_REVIEW");
  assert.equal(JSON.stringify(result).includes("010-0000-0008"), false);
});

test("생년월일만 일치하는 학생은 사람 검토 대상으로 보류한다", () => {
  const result = previewRallyzRoster([
    headers,
    ["테스트학생차", "", "월3", "", "", "", "2014-03-02", ""],
  ], ["월3"], [
    { id: "site-birth", name: "테스트학생차", branch: "2호점", birthDate: "2014-03-02", phone: null, parentPhone: null, guardianPhones: [], enrollments: [] },
  ]);
  assert.equal(result.students[0].siteMatch.status, "BIRTH_DATE_ONLY_REVIEW");
  assert.equal(result.students[0].status, "HELD");
});

test("다른 지점이나 지점 미지정 사이트 학생은 후보로 연결하지 않는다", () => {
  const grid = [
    headers,
    ["테스트학생카", "", "월3", "", "", "010-0000-0015", "2015-04-05", ""],
  ];
  const otherBranch = previewRallyzRoster(grid, ["월3"], [
    { id: "site-1", name: "테스트학생카", branch: "1호점", birthDate: "2015-04-05", guardianPhones: ["010-0000-0015"], enrollments: [] },
  ]);
  const unknownBranch = previewRallyzRoster(grid, ["월3"], [
    { id: "site-unknown", name: "테스트학생카", branch: null, birthDate: "2015-04-05", guardianPhones: ["010-0000-0015"], enrollments: [] },
  ]);
  assert.equal(otherBranch.students[0].siteMatch.status, "OTHER_BRANCH_REVIEW");
  assert.equal(unknownBranch.students[0].siteMatch.status, "SITE_BRANCH_UNCONFIRMED");
  assert.equal(otherBranch.students[0].siteMatch.siteStudentId, undefined);
});

test("동명이인 복수 일치와 사이트 반명 중복은 자동 매칭하지 않고 보류한다", () => {
  const result = previewRallyzRoster([
    headers,
    ["테스트학생거", "", "월3", "", "", "", "20120101", ""],
  ], ["월3", "월3"], [
    { id: "site-a", name: "테스트학생거", branch: "2호점", birthDate: "2012-01-01", enrollments: [] },
    { id: "site-b", name: "테스트학생거", branch: "2호점", birthDate: "2012-01-01", enrollments: [] },
  ]);
  assert.equal(result.students[0].status, "HELD");
  assert.ok(result.students[0].heldReasons.includes("CLASS_AMBIGUOUS"));
  assert.ok(result.students[0].heldReasons.includes("MULTIPLE_SITE_MATCHES"));
});

test("이름만 있는 행, 미등록 반, 동일 신원키의 연락처 충돌은 HELD 처리한다", () => {
  const result = previewRallyzRoster([
    headers,
    ["테스트학생다", "", "월3", "", "", "", "", ""],
    ["테스트학생라", "", "없는반", "", "보호자", "010-0000-0004", "20140101", ""],
    ["테스트학생마", "", "월3", "", "보호자", "010-0000-0005", "20130101", ""],
    ["테스트학생마", "", "월3", "", "보호자", "010-0000-0006", "20130101", ""],
  ], ["월3"]);

  assert.equal(result.studentCount, 3);
  assert.equal(result.heldRowCount, 4);
  assert.ok(result.students.every((student) => student.status === "HELD"));
  assert.ok(result.students.some((student) => student.heldReasons.includes("IDENTITY_INSUFFICIENT")));
  assert.ok(result.students.some((student) => student.heldReasons.includes("CLASS_UNMATCHED")));
  assert.ok(result.students.some((student) => student.heldReasons.includes("IDENTITY_CONTACT_CONFLICT")));
  assert.ok(result.students.every((student) => !("identity" in student)));
});

test("학생·반 값이 없는 행과 빈 시트는 집계에서 제외한다", () => {
  const result = previewRallyzRoster([
    headers,
    ["", "", "", "", "", "", "", "무시할 결제값"],
  ], []);
  assert.equal(result.rowCount, 0);
  assert.equal(result.studentCount, 0);
  assert.equal(result.enrollmentCount, 0);
  assert.equal(result.heldRowCount, 0);
  assert.deepEqual(previewRallyzRoster([]), {
    rowCount: 0, studentCount: 0, enrollmentCount: 0, heldRowCount: 0, students: [],
  });
});
