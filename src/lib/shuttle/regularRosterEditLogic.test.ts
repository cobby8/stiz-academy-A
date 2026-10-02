import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error -- Node's type-stripping runner needs the runtime extension.
import { buildAddRows, buildMoveUpdates, groupRosterDay, nextServiceMonth, nextSortOrder, normalizeArriveTime, normalizeClassTime, normalizeCoords, rosterRowIdsForStudent, RosterInputError, validateAddInput, validateCopyInput, validateMoveInput, validateRemoveInput, validateStopEditInput, type RosterExistingRow } from "./regularRosterEditLogic.ts";

// 기존 행 한 줄
function row(over: Partial<RosterExistingRow> = {}): RosterExistingRow {
  return { id: "r1", weekday: 1, direction: "BOARD", classTime: "17:00~18:00", sortOrder: 3, studentId: "s1", studentName: "김민준", ...over };
}
const stop = { stopName: "다산자이 정문", arriveTime: "16:40", latitude: 37.6, longitude: 127.15 };

test("다음 달은 문자열 계산으로 연말을 넘긴다", () => {
  assert.equal(nextServiceMonth("2026-09"), "2026-10");
  assert.equal(nextServiceMonth("2026-12"), "2027-01");
  assert.throws(() => nextServiceMonth("2026-13"), RosterInputError);
});

test("도착시각은 HH:MM 으로 맞추고 비우면 null", () => {
  assert.equal(normalizeArriveTime("9:05"), "09:05");
  assert.equal(normalizeArriveTime(""), null);
  assert.equal(normalizeArriveTime(null), null);
  assert.throws(() => normalizeArriveTime("24:00"), RosterInputError);
  assert.throws(() => normalizeArriveTime("오후5시"), RosterInputError);
});

test("수업시간은 물결 주변 공백만 정리한다", () => {
  assert.equal(normalizeClassTime(" 17:00 ~ 18:00 "), "17:00~18:00");
  assert.throws(() => normalizeClassTime("  "), RosterInputError);
});

test("좌표는 둘 다 있거나 둘 다 없어야 하고 한국 범위여야 한다", () => {
  assert.deepEqual(normalizeCoords(null, null), { latitude: null, longitude: null });
  assert.deepEqual(normalizeCoords(37.6, 127.1), { latitude: 37.6, longitude: 127.1 });
  assert.throws(() => normalizeCoords(37.6, null), RosterInputError);
  assert.throws(() => normalizeCoords(0, 0), RosterInputError);
});

test("학생 추가 입력: 학생·요일·등하원 중 하나는 필수", () => {
  const base = { serviceMonth: "2026-10", studentId: "s1", weekdays: [3, 1, 1], classTime: "17:00~18:00", board: stop, alight: null };
  const ok = validateAddInput(base);
  assert.deepEqual(ok.weekdays, [1, 3]);
  assert.equal(ok.alight, null);
  assert.throws(() => validateAddInput({ ...base, studentId: "", studentName: "" }), /학생을 선택/);
  assert.throws(() => validateAddInput({ ...base, weekdays: [] }), /요일/);
  assert.throws(() => validateAddInput({ ...base, board: null }), /하나 이상/);
  assert.throws(() => validateAddInput({ ...base, board: { ...stop, stopName: " " } }), /등원 정류장 이름/);
  assert.throws(() => validateAddInput({ ...base, serviceMonth: "2026-9" }), /YYYY-MM/);
});

test("정렬순서는 같은 요일·방향·수업의 마지막 뒤, 없으면 그 요일 맨 뒤", () => {
  const rows = [row({ sortOrder: 2 }), row({ id: "r2", sortOrder: 5 }), row({ id: "r3", direction: "ALIGHT", sortOrder: 9 })];
  assert.equal(nextSortOrder(rows, 1, "BOARD", "17:00~18:00"), 6);
  assert.equal(nextSortOrder(rows, 1, "BOARD", "19:00~20:00"), 10);
  assert.equal(nextSortOrder(rows, 2, "BOARD", "17:00~18:00"), 0);
});

test("학생 추가는 요일×방향마다 행을 만들고 같은 요청 안에서도 순서를 이어 붙인다", () => {
  const input = validateAddInput({ serviceMonth: "2026-10", studentId: "s9", weekdays: [1, 2], classTime: "17:00~18:00", board: stop, alight: { ...stop, arriveTime: "" } });
  const rows = buildAddRows(input, [row()], "이서연");
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => [r.weekday, r.direction, r.sortOrder]), [[1, "BOARD", 4], [1, "ALIGHT", 5], [2, "BOARD", 0], [2, "ALIGHT", 1]]);
  assert.equal(rows[1].arriveTime, null);
});

test("이미 같은 요일·방향·수업에 있는 학생은 중복 추가를 거부한다", () => {
  const input = validateAddInput({ serviceMonth: "2026-10", studentId: "s1", weekdays: [1], classTime: "17:00~18:00", board: stop, alight: null });
  assert.throws(() => buildAddRows(input, [row()], "김민준"), /이미 명단에 있습니다/);
  // 이름만 등록된 학생도 이름으로 중복을 막는다
  const byName = validateAddInput({ serviceMonth: "2026-10", studentName: "김 민준", weekdays: [1], classTime: "17:00~18:00", board: stop, alight: null });
  assert.throws(() => buildAddRows(byName, [row({ studentId: null })], "김 민준"), /이미 명단에 있습니다/);
});

test("반이동은 새 요일·수업으로 옮기고 그 자리에 이미 있으면 거부한다", () => {
  const rows = [row(), row({ id: "r2", direction: "ALIGHT", sortOrder: 4 }), row({ id: "x1", weekday: 3, classTime: "18:00~19:00", studentId: "s2", sortOrder: 7 })];
  const updates = buildMoveUpdates(["r1", "r2"], 3, "18:00~19:00", rows);
  assert.deepEqual(updates, [
    { id: "r1", weekday: 3, classTime: "18:00~19:00", sortOrder: 8 },
    { id: "r2", weekday: 3, classTime: "18:00~19:00", sortOrder: 9 },
  ]);
  const clash = [...rows, row({ id: "r9", weekday: 3, classTime: "18:00~19:00" })];
  assert.throws(() => buildMoveUpdates(["r1"], 3, "18:00~19:00", clash), /이미 있습니다/);
  assert.throws(() => buildMoveUpdates(["nope"], 3, "18:00~19:00", rows), /찾지 못했습니다/);
  assert.throws(() => buildMoveUpdates(["r1"], 3, "18:00~19:00", [row({ direction: "PIVOT" })]), /찾지 못했습니다/);
});

test("반이동은 한 학생의 행만 받는다(다른 학생 행이 섞이면 거부)", () => {
  // studentId 가 다른 두 학생
  const mixed = [row(), row({ id: "r2", direction: "ALIGHT", studentId: "s2", studentName: "이서연" })];
  assert.throws(() => buildMoveUpdates(["r1", "r2"], 3, "18:00~19:00", mixed), /한 학생/);
  // 이름만 등록된 행: 같은 이름이라도 학부모 전화가 다르면 다른 학생
  const byName = [
    row({ studentId: null, studentName: "박지호", parentPhone: "010-1111-2222" }),
    row({ id: "r2", direction: "ALIGHT", studentId: null, studentName: "박지호", parentPhone: "010-3333-4444" }),
  ];
  assert.throws(() => buildMoveUpdates(["r1", "r2"], 3, "18:00~19:00", byName), /한 학생/);
  // 이름·전화가 같으면 같은 학생 → 통과
  const same = [byName[0], { ...byName[1], parentPhone: "010-1111-2222" }];
  assert.equal(buildMoveUpdates(["r1", "r2"], 3, "18:00~19:00", same).length, 2);
});

test("빼기·반이동·정류장·복사 입력 검증", () => {
  assert.deepEqual(validateRemoveInput({ serviceMonth: "2026-10", ids: ["a", "a", " b "] }).ids, ["a", "b"]);
  assert.throws(() => validateRemoveInput({ serviceMonth: "2026-10", ids: [] }), RosterInputError);
  assert.equal(validateMoveInput({ serviceMonth: "2026-10", ids: ["a"], weekday: "2", classTime: "17:00~18:00" }).weekday, 2);
  assert.throws(() => validateMoveInput({ serviceMonth: "2026-10", ids: ["a"], weekday: 7, classTime: "x" }), /요일/);
  const edit = validateStopEditInput({ serviceMonth: "2026-10", id: "a", stop, applyToAll: "true" });
  assert.equal(edit.applyToAll, false); // 문자열 "true" 로는 일괄 변경이 켜지지 않는다
  assert.throws(() => validateCopyInput({ sourceMonth: "2026-10", targetMonth: "2026-10" }), /같습니다/);
});

test("화면 묶음: 수업시간별 학생에 등원·하원을 붙이고 운영 정차는 뺀다", () => {
  const base = { classTime: "17:00~18:00", arriveTime: null, stopName: "A", studentPhone: null, parentPhone: "010-1111-2222", note: null, sortOrder: 0 };
  const stops = [
    { ...base, id: "1", weekday: 1, direction: "BOARD", studentName: "나", studentId: "s2" },
    { ...base, id: "2", weekday: 1, direction: "ALIGHT", studentName: "나", studentId: "s2", stopName: "B" },
    { ...base, id: "3", weekday: 1, direction: "BOARD", studentName: "가", studentId: null },
    { ...base, id: "4", weekday: 1, direction: "PIVOT", studentName: null, studentId: null },
    { ...base, id: "5", weekday: 1, direction: "BOARD", studentName: "다", studentId: "s3", classTime: null },
    { ...base, id: "6", weekday: 2, direction: "BOARD", studentName: "나", studentId: "s2" },
  ];
  const groups = groupRosterDay(stops, 1);
  assert.deepEqual(groups.map((g) => g.classTime), ["17:00~18:00", ""]);
  assert.deepEqual(groups[0].students.map((s) => s.studentName), ["가", "나"]);
  assert.equal(groups[0].students[1].board?.id, "1");
  assert.equal(groups[0].students[1].alight?.id, "2");
  assert.deepEqual(rosterRowIdsForStudent(stops, "id:s2"), ["1", "2", "6"]);
});
