import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node의 타입 제거 실행기는 런타임 확장자를 요구한다.
import { findSheetEnrollmentRows } from "./googleSheetsOperations.ts";

function row(name: string, month: string, birth: string, phone: string) {
  const values = Array(38).fill("");
  values[3] = name;
  values[7] = month;
  values[24] = birth;
  values[27] = phone;
  return values;
}

test("같은 이름이어도 적용 월과 생년월일이 맞는 행만 선택한다", () => {
  const rows = [Array(38).fill(""), row("김민서", "2026년 9월", "2014. 5. 8", "010-1111-2222"), row("김민서", "2026년 8월", "2014. 5. 8", "010-1111-2222"), row("김민서", "2026년 9월", "2016. 9. 9", "010-3333-4444")];
  assert.deepEqual(findSheetEnrollmentRows(rows, { studentName: "김민서", birthDate: new Date("2014-05-08T00:00:00Z"), parentPhone: null, targetMonth: "2026-09" }), [2]);
});

test("생년월일 표기가 달라도 보호자 전화 뒷자리로 안정적으로 보완한다", () => {
  const rows = [Array(38).fill(""), row("김용준", "2026년 9월", "", "010-8989-8264")];
  assert.deepEqual(findSheetEnrollmentRows(rows, { studentName: "김용준", birthDate: new Date("2013-06-19T00:00:00Z"), parentPhone: "01089898264", targetMonth: "2026-09" }), [2]);
});
