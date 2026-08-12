import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// 원장 제보(2026-08-12): 8/13 결석을 미리 받아 보강을 배정하려는데 8/14 이후만 뜬다.
// 결석은 **미리** 고지받는 경우가 있으므로 오늘~결석일 사이에도 잡을 수 있어야 한다.

const source = await readFile("src/lib/seasonal/makeupWindow.ts", "utf8");
const { seoulDow, seoulYmd, classAlreadyStarted, findNextClassDate, MAKEUP_WINDOW_DAYS } = await import(
  `data:text/javascript;base64,${Buffer.from(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  ).toString("base64")}`
);

const kst = (s) => new Date(s).getTime();
const NOW = kst("2026-08-12T21:08:00+09:00"); // 실제 제보 시각(오늘 특강은 이미 끝난 뒤)
const ABSENT = kst("2026-08-13T09:30:00+09:00");
const WINDOW_END = ABSENT + MAKEUP_WINDOW_DAYS * 86400000;

test("요일은 KST 달력 기준이다", () => {
  // 실제 버그: `new Date(ymd+"T00:00:00+09:00").getUTCDay()` 는 UTC 로 전날 15시가 되어
  // 요일이 하루 밀렸다 — 금요일 반의 추천 날짜가 토요일로 나오고 있었다.
  assert.equal(seoulDow("2026-08-14"), 5); // 금
  assert.equal(seoulDow("2026-08-15"), 6); // 토
  assert.equal(seoulDow("2026-08-16"), 0); // 일
  assert.equal(new Date("2026-08-14T00:00:00+09:00").getUTCDay(), 4, "옛 방식은 하루 밀린다(회귀 감시용)");
  assert.ok(Number.isNaN(seoulDow("2026-8-14")));
});

test("미리 받은 결석은 결석일 이전 날짜도 후보가 된다", () => {
  // 8/20 결석을 8/12 에 신고 → 8/14(금) 반은 결석일 전이라도 잡을 수 있어야 한다.
  const farAbsence = kst("2026-08-20T09:30:00+09:00");
  const picked = findNextClassDate({
    dayOfWeek: 5, startTime: "16:00", nowMs: NOW, windowEndMs: farAbsence + MAKEUP_WINDOW_DAYS * 86400000,
  });
  assert.equal(picked, "2026-08-14");
});

test("오늘이 그 요일이고 수업이 아직이면 오늘로 잡는다", () => {
  // 2026-08-12 는 수요일(3). 오전 9시 기준이면 16시 수업은 아직 안 시작했다.
  const morning = kst("2026-08-12T09:00:00+09:00");
  assert.equal(seoulDow("2026-08-12"), 3);
  assert.equal(
    findNextClassDate({ dayOfWeek: 3, startTime: "16:00", nowMs: morning, windowEndMs: WINDOW_END }),
    "2026-08-12",
  );
});

test("오늘 수업이 이미 시작했으면 다음 주로 넘긴다", () => {
  // 21:08 에 16시 수업을 후보로 주면 배정해도 학생이 갈 수 없다.
  assert.equal(
    findNextClassDate({ dayOfWeek: 3, startTime: "16:00", nowMs: NOW, windowEndMs: WINDOW_END }),
    "2026-08-19",
  );
});

test("시작 시각을 못 읽으면 그 날을 막지 않는다", () => {
  // 있는 선택지를 숨기는 쪽이 더 나쁘다 — 원장이 보고 판단한다.
  assert.equal(classAlreadyStarted("2026-08-12", null, NOW), false);
  assert.equal(classAlreadyStarted("2026-08-12", "미정", NOW), false);
  assert.equal(classAlreadyStarted("2026-08-12", "16:00", NOW), true);
  assert.equal(classAlreadyStarted("2026-08-12", "23:00", NOW), false);
  assert.equal(
    findNextClassDate({ dayOfWeek: 3, startTime: null, nowMs: NOW, windowEndMs: WINDOW_END }),
    "2026-08-12",
  );
});

test("보강 기한이 지났으면 후보가 없다", () => {
  // 결석일 + 2개월이 이미 지난 건에 후보를 주면 약관을 어긴 배정이 된다.
  const oldAbsence = kst("2026-01-05T09:30:00+09:00");
  assert.equal(
    findNextClassDate({
      dayOfWeek: 3, startTime: "16:00", nowMs: NOW,
      windowEndMs: oldAbsence + MAKEUP_WINDOW_DAYS * 86400000,
    }),
    null,
  );
});

test("요일을 모르는 반은 후보에서 빠진다", () => {
  assert.equal(findNextClassDate({ dayOfWeek: null, startTime: "16:00", nowMs: NOW, windowEndMs: WINDOW_END }), null);
});

test("KST 날짜 변환이 자정 경계에서 밀리지 않는다", () => {
  assert.equal(seoulYmd(kst("2026-08-12T00:00:00+09:00")), "2026-08-12");
  assert.equal(seoulYmd(kst("2026-08-12T23:59:00+09:00")), "2026-08-12");
});

// ── 특강 후보 SQL 계약 ────────────────────────────────────────────────
const makeupLib = await readFile("src/lib/seasonal/makeup.ts", "utf8");

test("특강 후보의 시작점은 결석일이 아니라 지금이다", () => {
  assert.match(makeupLib, /AND sd\."startsAt" > now\(\)/);
  // 결석일을 하한으로 되돌리면 미리 받은 결석의 보강 자리가 다시 사라진다.
  assert.doesNotMatch(makeupLib, /AND sd\."startsAt" > \$3::timestamptz/);
});

test("보강 기한 2개월 상한은 결석일 기준 그대로다", () => {
  // 약관 「수업의 보강」 — 상한까지 함께 옮기면 기한이 늘어난다.
  assert.match(makeupLib, /sd\."startsAt" <= \(\$3::timestamptz \+ interval '60 days'\)/);
  assert.equal(MAKEUP_WINDOW_DAYS, 60);
});

test("정원·중복 검사는 그대로 남아 있다", () => {
  // 날짜 범위를 넓혔으므로 나머지 방어가 살아 있는지 함께 확인한다.
  assert.match(makeupLib, /loadSeasonalMakeupRooms/);
  assert.match(makeupLib, /MAKEUP_ALREADY_EXISTS/);
  assert.match(makeupLib, /assertTargetDateFree/);
});
