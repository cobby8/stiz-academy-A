import assert from "node:assert/strict";
import test from "node:test";

import {
  createCsv,
  createSafeCsvFilename,
  escapeCsvField,
  maskPhoneNumber,
  sanitizeCsvCell,
} from "./roster-export.ts";

test("전화번호는 형식과 관계없이 가운데 번호를 가린다", () => {
  assert.equal(maskPhoneNumber("010-1234-5678"), "010-****-5678");
  assert.equal(maskPhoneNumber("010 9876 5432"), "010-****-5432");
  assert.equal(maskPhoneNumber("123"), "****");
  assert.equal(maskPhoneNumber(null), "");
});

test("CSV 셀은 제어문자를 제거하고 줄바꿈을 CRLF로 통일한다", () => {
  assert.equal(sanitizeCsvCell("가\u0000나\u0007다"), "가나다");
  assert.equal(sanitizeCsvCell("첫째\n둘째\r셋째\r\n넷째"), "첫째\r\n둘째\r\n셋째\r\n넷째");
});

test("공백이나 제어문자 뒤의 위험한 수식 접두어도 무력화한다", () => {
  assert.equal(sanitizeCsvCell("=1+1"), "'=1+1");
  assert.equal(sanitizeCsvCell("  +SUM(A1:A2)"), "'  +SUM(A1:A2)");
  assert.equal(sanitizeCsvCell("\t@cmd"), "'@cmd");
  assert.equal(sanitizeCsvCell("-10"), "'-10");
  assert.equal(sanitizeCsvCell("안전한 값"), "안전한 값");
});

test("쉼표, 따옴표, 줄바꿈이 있는 필드는 RFC 4180 형식으로 감싼다", () => {
  assert.equal(escapeCsvField('홍길동, "학생"'), '"홍길동, ""학생"""');
  assert.equal(escapeCsvField("한 줄\n두 줄"), '"한 줄\r\n두 줄"');
});

test("CSV는 고정 열만 내보내고 BOM 및 CRLF를 사용한다", () => {
  const csv = createCsv(
    [
      { key: "name", header: "학생명" },
      { key: "phone", header: "연락처" },
    ],
    [{ name: "홍길동", phone: "010-****-5678", paymentUrl: "https://secret.example" }],
  );

  assert.equal(csv, "\uFEFF학생명,연락처\r\n홍길동,010-****-5678\r\n");
  assert.equal(csv.includes("secret.example"), false);
});

test("파일명에서 경로 및 운영체제 금지 문자를 제거한다", () => {
  assert.equal(createSafeCsvFilename("여름/특강: 명단?.csv"), "여름_특강_ 명단_.csv");
  assert.equal(createSafeCsvFilename("  ...  "), "특강명단.csv");
});
