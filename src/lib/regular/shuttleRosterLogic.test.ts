import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error -- Node's type-stripping runner needs the runtime extension.
import { buildRegularShuttleRoster, hasCoords, pickPlaceForDirection, weekdayNameFromDate, type RegularShuttlePlace, type RegularShuttleRawRider } from "./shuttleRosterLogic.ts";

// 좌표 있는 위치 한 벌
function coordPlace(over: Partial<RegularShuttlePlace> = {}): RegularShuttlePlace {
  return {
    location: "다산자이 정문",
    address: "경기 남양주시 다산동 1",
    roadAddress: "다산순환로 1",
    latitude: 37.6,
    longitude: 127.15,
    placeId: "p1",
    ...over,
  };
}
// 좌표 없는 위치 한 벌
function emptyPlace(over: Partial<RegularShuttlePlace> = {}): RegularShuttlePlace {
  return {
    location: null,
    address: null,
    roadAddress: null,
    latitude: null,
    longitude: null,
    placeId: null,
    ...over,
  };
}

function rider(over: Partial<RegularShuttleRawRider> = {}): RegularShuttleRawRider {
  return {
    studentId: "st1",
    studentName: "홍길동",
    childGrade: "초등 5학년",
    childPhone: null,
    parentName: "홍부모",
    parentPhone: "01011112222",
    classId: "c1",
    className: "월수반",
    dayOfWeek: "Mon",
    classStart: "16:00",
    classEnd: "17:20",
    applicationId: "app1",
    shuttleNeeded: true,
    pickupTime: "15:30",
    pickup: coordPlace(),
    dropoff: emptyPlace(),
    ...over,
  };
}

test("weekdayNameFromDate: 달력 날짜의 요일을 Class.dayOfWeek 문자열로 준다", () => {
  // 2026-07-27 은 월요일
  assert.equal(weekdayNameFromDate("2026-07-27"), "Mon");
  // 2026-07-26 은 일요일
  assert.equal(weekdayNameFromDate("2026-07-26"), "Sun");
});

test("hasCoords: 위경도 둘 다 있어야 true", () => {
  assert.equal(hasCoords(coordPlace()), true);
  assert.equal(hasCoords(emptyPlace()), false);
  assert.equal(hasCoords(coordPlace({ longitude: null })), false);
});

test("pickPlaceForDirection: 등원은 등원 좌표 그대로", () => {
  const r = rider();
  assert.deepEqual(pickPlaceForDirection(r, "PICKUP"), r.pickup);
});

test("pickPlaceForDirection: 하원 좌표 있으면 하원 사용", () => {
  const r = rider({ dropoff: coordPlace({ location: "학원 앞", latitude: 37.7, longitude: 127.2 }) });
  const p = pickPlaceForDirection(r, "DROPOFF");
  assert.equal(p.latitude, 37.7);
  assert.equal(p.location, "학원 앞");
});

test("pickPlaceForDirection: 하원 좌표 없으면 등원 좌표로 폴백(라벨은 하원 우선)", () => {
  const r = rider({ dropoff: emptyPlace({ location: "다른 하차지" }) });
  const p = pickPlaceForDirection(r, "DROPOFF");
  // 좌표는 등원 폴백
  assert.equal(p.latitude, r.pickup.latitude);
  assert.equal(p.longitude, r.pickup.longitude);
  // 라벨은 하원 표기 우선
  assert.equal(p.location, "다른 하차지");
});

test("buildRegularShuttleRoster: 좌표 있는 사람은 riders, 없는 사람은 unassigned", () => {
  const withCoord = rider({ studentId: "a", studentName: "가나다" });
  const noCoord = rider({ studentId: "b", studentName: "라마바", pickup: emptyPlace(), dropoff: emptyPlace() });
  const result = buildRegularShuttleRoster([withCoord, noCoord], "PICKUP", "Mon");
  assert.equal(result.riders.length, 1);
  assert.equal(result.riders[0].studentId, "a");
  assert.equal(result.unassigned.length, 1);
  assert.equal(result.unassigned[0].studentId, "b");
  assert.equal(result.dayOfWeek, "Mon");
});

test("buildRegularShuttleRoster: 하원에서 등원 폴백 좌표가 있으면 배차 가능(riders)", () => {
  // 등원 좌표만 있고 하원 좌표는 없는 학생 → 하원 방향에서도 폴백으로 배차 가능해야 한다.
  const r = rider({ pickup: coordPlace(), dropoff: emptyPlace() });
  const result = buildRegularShuttleRoster([r], "DROPOFF", "Mon");
  assert.equal(result.riders.length, 1);
  assert.equal(result.unassigned.length, 0);
});

test("buildRegularShuttleRoster: 수업 시작 시각 → 이름 순으로 정렬", () => {
  const late = rider({ studentId: "late", studentName: "가", classStart: "17:00" });
  const early = rider({ studentId: "early", studentName: "하", classStart: "15:00" });
  const sameTimeA = rider({ studentId: "sa", studentName: "김", classStart: "16:00" });
  const sameTimeB = rider({ studentId: "sb", studentName: "이", classStart: "16:00" });
  const result = buildRegularShuttleRoster([late, sameTimeB, early, sameTimeA], "PICKUP", "Mon");
  assert.deepEqual(
    result.riders.map((x) => x.studentId),
    ["early", "sa", "sb", "late"],
  );
});
