import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNoticeBody, groupTimesByDay, formatDays, floorTo5, toKoreanTime, toParentStopLabel, toKoreanDate, parseEtaMinutes,
} from "../src/lib/seasonal/shuttleNoticeFormat.ts";

// 실제 학부모에게 나가는 문자다. 잘못 나가면 회수할 수 없으므로 문안 생성을 실행해서 검증한다.

test("시각은 5분 단위로 **내림**한다(늦게 안내하면 차를 놓친다)", () => {
  assert.equal(floorTo5(8 * 60 + 56), 8 * 60 + 55);
  assert.equal(floorTo5(8 * 60 + 52), 8 * 60 + 50);
  assert.equal(floorTo5(9 * 60 + 0), 9 * 60);
  // 올림이 되어 버리면 안 된다 — 09:01이 09:05로 안내되면 학부모가 늦게 나온다.
  assert.notEqual(floorTo5(9 * 60 + 1), 9 * 60 + 5);
  assert.equal(floorTo5(9 * 60 + 1), 9 * 60);
});

test("요일마다 시각이 다르면 **합치지 않고 나눠** 적는다 (김대후 실제 사례)", () => {
  // 월~목 09:20 / 금 09:12. 하나로 합치면 09:10이 되어 월~목에 10분이나 일찍 나오게 된다.
  const body = buildNoticeBody({
    studentName: "김대후",
    stopLabel: "도농초 앞 버스정류장",
    times: [
      { dow: 1, minutes: 9 * 60 + 20 }, { dow: 2, minutes: 9 * 60 + 20 },
      { dow: 3, minutes: 9 * 60 + 20 }, { dow: 4, minutes: 9 * 60 + 20 },
      { dow: 5, minutes: 9 * 60 + 12 },
    ],
  });
  assert.match(body, /월~목 오전 9시 20분/);
  assert.match(body, /금 오전 9시 10분/);
  // ★ 회귀 방지: 전 요일이 9시 10분으로 뭉뚱그려지면 안 된다.
  assert.doesNotMatch(body, /월~금 오전 9시 10분/);
});

test("탁경일: 월·금 09:00, 화~목 08:55 → 두 줄로 정확히 나뉜다", () => {
  const body = buildNoticeBody({
    studentName: "탁경일",
    stopLabel: "반도유보라 메이플타운 맘스테이션",
    times: [
      { dow: 1, minutes: 9 * 60 }, { dow: 2, minutes: 8 * 60 + 55 },
      { dow: 3, minutes: 8 * 60 + 55 }, { dow: 4, minutes: 8 * 60 + 55 },
      { dow: 5, minutes: 9 * 60 },
    ],
  });
  // 같은 시각(09:00)인 월·금이 한 묶음으로, 화~목(08:55)이 다른 묶음으로 나온다.
  assert.match(body, /월·금 오전 9시/);
  assert.match(body, /화~목 오전 8시 55분/);
  assert.doesNotMatch(body, /월~금 오전 8시 55분/, "합쳐서 월·금을 5분 일찍 안내하면 안 된다");
});

test("모든 요일이 같은 시각이면 한 줄로 간단히 적는다", () => {
  const body = buildNoticeBody({
    studentName: "이수연", stopLabel: "롯데낙천대아파트 관리사무소 앞",
    times: [{ dow: 1, minutes: 9 * 60 + 17 }, { dow: 3, minutes: 9 * 60 + 15 }],
  });
  assert.match(body, /▪ 탑승 시간 : 월·수 오전 9시 15분/);
});

test("안내 시각은 실제 시각보다 **늦지 않다**(늦으면 차를 놓친다)", () => {
  // 무작위성 없이, 실제 노선에서 나온 시각들로 전수 확인한다.
  const samples = [
    8 * 60 + 52, 8 * 60 + 55, 8 * 60 + 56, 8 * 60 + 59,
    9 * 60, 9 * 60 + 4, 9 * 60 + 5, 9 * 60 + 8, 9 * 60 + 11, 9 * 60 + 12,
    9 * 60 + 15, 9 * 60 + 17, 9 * 60 + 20,
  ];
  for (const m of samples) {
    const g = groupTimesByDay([{ dow: 1, minutes: m }]);
    assert.ok(g[0].minutes <= m, `${m}분 → ${g[0].minutes}분: 안내가 실제보다 늦다`);
    assert.ok(m - g[0].minutes < 5, `${m}분 → ${g[0].minutes}분: 5분 이상 일찍 안내한다`);
  }
});

test("요일 표기: 연속 3일 이상은 물결, 아니면 가운뎃점", () => {
  assert.equal(formatDays([1, 3]), "월·수");
  assert.equal(formatDays([1, 2, 3, 4, 5]), "월~금");
  assert.equal(formatDays([2, 3, 4]), "화~목");
  assert.equal(formatDays([2, 4]), "화·목");
  assert.equal(formatDays([4, 5]), "목·금");
  assert.equal(formatDays([3, 1, 1]), "월·수", "중복·순서 뒤섞임도 정리된다");
});

test("시각 한글 표기", () => {
  assert.equal(toKoreanTime(9 * 60), "오전 9시");
  assert.equal(toKoreanTime(8 * 60 + 55), "오전 8시 55분");
  assert.equal(toKoreanTime(13 * 60 + 5), "오후 1시 5분");
});

test("무료 거점 내부 표기는 학부모용으로 다듬는다", () => {
  assert.equal(toParentStopLabel("무료탑승 · 새봄중 버스정류장"), "새봄중 버스정류장 (무료 탑승)");
  // 괄호형 표기도 빈 껍데기를 남기지 않아야 한다("1호점() (무료 탑승)"가 나가면 안 된다).
  assert.equal(toParentStopLabel("1호점(무료탑승)"), "1호점 (무료 탑승)");
  assert.equal(toParentStopLabel("무료탑승"), "무료 탑승 거점");
  // 일반 정류장은 그대로 둔다.
  assert.equal(toParentStopLabel("도농초 앞 버스정류장"), "도농초 앞 버스정류장");
  assert.equal(toParentStopLabel("다산플루리움 514동 앞 (108동 맞은편)"), "다산플루리움 514동 앞 (108동 맞은편)");
});

test("아직 시작 전인 학생은 '언제부터'가 문안에 들어간다", () => {
  const body = buildNoticeBody({
    studentName: "김윤", stopLabel: "힐스테이트 다산",
    times: [{ dow: 1, minutes: 8 * 60 + 56 }, { dow: 3, minutes: 8 * 60 + 52 }],
    startsFrom: "2026-08-10",
  });
  assert.match(body, /8월 10일\(월\)부터 시작하는/);
  // 월 08:56 → 08:55, 수 08:52 → 08:50. 시각이 다르므로 합치지 않고 나눠 적는다.
  assert.match(body, /월 오전 8시 55분/);
  assert.match(body, /수 오전 8시 50분/);
  assert.match(body, /힐스테이트 다산/);
});

test("이미 다니는 학생 문안에는 '언제부터'가 없다", () => {
  const body = buildNoticeBody({
    studentName: "김대후", stopLabel: "도농초 앞 버스정류장",
    times: [{ dow: 1, minutes: 9 * 60 + 20 }], startsFrom: null,
  });
  assert.doesNotMatch(body, /부터 시작하는/);
  assert.match(body, /등원 셔틀 탑승 시간을 안내드립니다/);
});

test("문안에 다른 학생 정보가 절대 섞이지 않는다(개인정보)", () => {
  const body = buildNoticeBody({
    studentName: "이수연", stopLabel: "롯데낙천대아파트 관리사무소 앞",
    times: [{ dow: 1, minutes: 9 * 60 + 17 }, { dow: 3, minutes: 9 * 60 + 15 }],
  });
  assert.match(body, /이수연 학부모님/);
  for (const other of ["김하임", "탁경일", "김대후", "김윤"]) {
    assert.doesNotMatch(body, new RegExp(other), `${other}가 남의 문자에 들어가면 개인정보 유출이다`);
  }
});

test("발송부가 [STIZ]를 붙이므로 문안이 접두어를 중복하지 않는다", () => {
  const body = buildNoticeBody({
    studentName: "가나", stopLabel: "정류장", times: [{ dow: 1, minutes: 540 }],
  });
  assert.doesNotMatch(body, /^\[STIZ\]/);
});

test("탑승 시각이 하나도 없으면 문안을 만들지 않고 실패시킨다", () => {
  assert.throws(() => buildNoticeBody({ studentName: "가나", stopLabel: "정류장", times: [] }), /탑승 시각/);
});

test("etaLabel에서 시각을 읽어낸다", () => {
  assert.equal(parseEtaMinutes("09:17 승차"), 9 * 60 + 17);
  assert.equal(parseEtaMinutes("8:05"), 8 * 60 + 5);
  assert.equal(parseEtaMinutes(null), null);
  assert.equal(parseEtaMinutes("승차"), null);
});

test("날짜 한글 변환", () => {
  assert.equal(toKoreanDate("2026-08-10"), "8월 10일(월)");
  assert.equal(toKoreanDate("2026-08-03"), "8월 3일(월)");
  assert.equal(toKoreanDate(null), null);
});
