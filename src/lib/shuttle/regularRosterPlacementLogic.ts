// 셔틀 명단 「학생 추가」 — 등록 수업 불러오기 · 현재 운행표 대조 · 넣을 위치 추천(순수 함수, DB 접근 없음).
// ─────────────────────────────────────────────────────────────────────────────
// 왜 필요한가(2026-10-03 원장 지시):
//   "현재 시간표를 안 보면서 배정하는 건 불가능하다." 예전 학생 추가는 수업시간을 손으로 치고
//   새 학생을 그 수업 맨 뒤에 붙였다. 이제는
//     ① 학생의 등록 수업(요일·시간)을 불러와 수업 칸을 미리 고르고,
//     ② 그 칸의 현재 운행 순서를 **기사님 화면과 같은 함수**로 보여 주며,
//     ③ 가까운 정차가 있으면 합류, 없으면 이동 거리가 가장 적게 늘어나는 자리를 추천한다.
// ⚠️ node 타입 제거 실행으로 테스트하므로 '@/' 경로 import·enum 을 쓰지 않는다(런타임 import 는 .ts 확장자).

// Node 타입 제거 테스트는 확장자가 필요하고, Next 빌드는 같은 파일을 그대로 해석한다(dispatchIncrement.ts 와 같은 방식).
// @ts-expect-error -- TypeScript runtime test compatibility
import { buildFallbackClasses, normalizeStopName, selectDriverDayRows, type DriverStop } from "./regularDriverRouteLogic.ts";
// @ts-expect-error -- TypeScript runtime test compatibility
import { parseClassTimeRange } from "./regularRosterCheckLogic.ts";
// @ts-expect-error -- TypeScript runtime test compatibility
import { classTimeKey, rosterStudentKeyResolver, WEEKDAY_LABELS, type RosterDirection, type RosterPlacementMode } from "./regularRosterEditLogic.ts";
// 거리 계산은 정차 병합의 단일 기준 모듈 것을 그대로 쓴다(새 거리 함수를 만들지 않는다).
// @ts-expect-error -- TypeScript runtime test compatibility
import { distanceMeters } from "../seasonal/stopMerge.ts";
import type { RegularShuttleStop } from "./regularSheet";

/** 이 거리(미터) 안에 기존 정차가 있으면 새 정차를 만들지 않고 합류를 추천한다. */
export const JOIN_RADIUS_METERS = 300;

export type GeoPoint = { lat: number; lng: number };

// ── 등록 수업 → 명단 수업 칸 ────────────────────────────────────

/** Class.dayOfWeek 는 "Mon","Tue"… 형식(regular/shuttleRosterLogic DOW_NAMES 와 같다). */
const DOW_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function dowToWeekday(v: string | null | undefined): number | null {
  const k = String(v ?? "").trim();
  if (k in DOW_INDEX) return DOW_INDEX[k];
  const i = WEEKDAY_LABELS.indexOf(k.replace(/요일$/, "") as (typeof WEEKDAY_LABELS)[number]);
  return i >= 0 ? i : null;
}

/** '9:5' 같은 값은 거부, '9:05' → '09:05'. 형식이 아니면 null. */
function hhmm(v: string | null | undefined): string | null {
  const m = String(v ?? "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function toMin(v: string | null | undefined): number | null {
  const t = hhmm(v);
  return t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null;
}

function minToHhmm(min: number): string {
  const v = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

/**
 * 수업 시작·종료 → 명단 수업시간 글자. 명단에 같은 시각의 글자가 이미 있으면 **그 글자를 그대로** 쓴다
 * (기사님 화면은 수업시간 글자로 섹션을 묶으므로 '17:00~18:00' 과 '17:00 ~ 18:00' 이 갈리면 안 된다).
 */
export function matchRosterClassTime(start: string, end: string, existingClassTimes: readonly string[]): string | null {
  const s = toMin(start), e = toMin(end);
  if (s == null || e == null) return null;
  const hit = existingClassTimes.find((ct) => {
    const r = parseClassTimeRange(ct);
    return r != null && r.start === s && r.end === e;
  });
  return hit ?? `${minToHhmm(s)}~${minToHhmm(e)}`;
}

/**
 * 서버가 내려주는 등록 수업 — 다니는 수업(ACTIVE)과 휴원 중(PAUSED). 퇴원(WITHDRAWN) 등은 오지 않는다.
 * 휴원도 내려주는 이유: 복귀 직전 학생을 미리 배정하는 것이 학생 추가의 주 용도라서(2026-10-03 운영 실측: 휴원생 3수업 전부 누락).
 */
export type EnrolledClass = { weekday: number; startTime: string; endTime: string; className: string | null; programName: string | null; status?: "ACTIVE" | "PAUSED" };
/** paused = 휴원 중 수업(미리 체크하지 않고 「휴원」 배지로 보여 준다). */
export type ClassSlotOption = { weekday: number; classTime: string; label: string; paused: boolean };

/** 등록 수업 → 수업 칸 후보(요일 월→일, 시각 순, 같은 요일·시각은 하나 — 다니는 수업이 휴원보다 우선). */
export function enrolledClassSlots(enrolled: readonly EnrolledClass[], existingClassTimes: readonly string[]): ClassSlotOption[] {
  const out: ClassSlotOption[] = [];
  const seen = new Set<string>();
  for (const c of enrolled) {
    if (!Number.isInteger(c.weekday) || c.weekday < 0 || c.weekday > 6) continue;
    const classTime = matchRosterClassTime(c.startTime, c.endTime, existingClassTimes);
    if (!classTime) continue;
    const key = `${c.weekday}|${classTimeKey(classTime)}`;
    const paused = c.status === "PAUSED";
    if (seen.has(key)) {
      // 같은 칸에 다니는 수업이 있으면 휴원 표시를 지운다.
      const prev = out.find((o) => `${o.weekday}|${classTimeKey(o.classTime)}` === key);
      if (prev && !paused) prev.paused = false;
      continue;
    }
    seen.add(key);
    const name = [c.programName, c.className].filter(Boolean).join(" · ");
    out.push({ weekday: c.weekday, classTime, label: `${WEEKDAY_LABELS[c.weekday]} ${classTime}${name ? ` · ${name}` : ""}`, paused });
  }
  const rank = (w: number) => (w === 0 ? 7 : w);
  return out.sort((a, b) => rank(a.weekday) - rank(b.weekday) || a.classTime.localeCompare(b.classTime));
}

// ── 이 학생이 그 달 이미 타는 행 ──────────────────────────────────

/**
 * 그 달 명단에서 이 학생의 등·하원 행 — studentId 일치 + studentId 없는 행 중 이름(공백 무시)+학부모 전화 끝4자리 일치.
 * 판정은 명단 화면이 학생을 묶는 rosterStudentKeyResolver 를 그대로 쓴다(학생 자신을 한 줄 덧붙여 이름+전화 → id 연결).
 * 같은 이름+전화에 다른 studentId 가 있으면 resolver 가 묶지 않으므로 남의 행이 섞이지 않는다.
 */
export function studentRosterRows<T extends RegularShuttleStop>(
  stops: readonly T[],
  student: { id: string; name: string; parentPhone: string | null },
): T[] {
  const keyOf = rosterStudentKeyResolver([...stops, { studentId: student.id, studentName: student.name, parentPhone: student.parentPhone }]);
  const key = `id:${student.id}`;
  return stops.filter((s) => (s.direction === "BOARD" || s.direction === "ALIGHT") && !!s.studentName && keyOf(s) === key);
}

// ── 현재 운행표 한 칸(요일·수업·방향) ────────────────────────────

const NOT_ABSENT = () => false;

/**
 * 그 요일·수업·방향의 현재 정차 목록 — 기사님 화면(폴백)과 **같은 함수**로 만든다.
 * 수업시간은 공백 차이를 무시하고 찾는다(새 행은 서버가 그 요일의 기존 글자로 맞춰 넣는다).
 */
export function findRouteCell(stops: readonly RegularShuttleStop[], weekday: number, classTime: string, direction: RosterDirection): DriverStop[] {
  const classes = buildFallbackClasses(selectDriverDayRows(stops, weekday), NOT_ABSENT);
  const key = classTimeKey(classTime);
  const hit = classes.find((c: { classTime: string }) => classTimeKey(c.classTime) === key);
  if (!hit) return [];
  return direction === "BOARD" ? hit.board : hit.alight;
}

// ── 넣을 위치 추천 ─────────────────────────────────────────────

/** JOIN = stops[stopIndex] 정차에 합류 / INSERT = position 번째 자리(0 = 첫 정차 앞, stops.length = 맨 뒤)에 새 정차. */
export type PlacementChoice = { kind: "JOIN"; stopIndex: number } | { kind: "INSERT"; position: number };

export type PlacementSuggestion = {
  choice: PlacementChoice;
  arriveTime: string | null;
  /** 화면에 그대로 보여 줄 추천 이유(한국어). */
  reason: string;
  /** 좌표가 없어 거리 계산에서 뺀 정차 이름. */
  skippedNoCoord: string[];
};

type RouteStop = Pick<DriverStop, "label" | "arriveTime" | "lat" | "lng"> & { rows: { rowId: string }[] };

function pointOf(s: { lat: number | null; lng: number | null } | null | undefined): GeoPoint | null {
  return s && s.lat != null && s.lng != null && Number.isFinite(s.lat) && Number.isFinite(s.lng) ? { lat: s.lat, lng: s.lng } : null;
}
function dist(a: GeoPoint, b: GeoPoint): number {
  return distanceMeters(a.lat, a.lng, b.lat, b.lng);
}

/**
 * position 자리에 넣을 때의 예상 시각 — 앞뒤 정차 시각을 거리 비율로 나눈다.
 * 앞이나 뒤 정차(또는 그 시각)가 없으면 null(비워 두고 원장이 입력). 좌표가 없으면 가운데 값.
 */
export function estimateInsertTime(stops: readonly RouteStop[], position: number, student: GeoPoint | null): string | null {
  const prev = stops[position - 1], next = stops[position];
  if (!prev || !next) return null;
  const t1 = toMin(prev.arriveTime), t2 = toMin(next.arriveTime);
  if (t1 == null || t2 == null) return null;
  const a = pointOf(prev), b = pointOf(next);
  let ratio = 0.5;
  if (student && a && b) {
    const d1 = dist(a, student), d2 = dist(student, b);
    if (d1 + d2 > 0) ratio = d1 / (d1 + d2);
  }
  return minToHhmm(t1 + (t2 - t1) * ratio);
}

/**
 * 추천 — ① 같은 정류장 이름(공백 무시) ② 직선 JOIN_RADIUS_METERS 이내 가장 가까운 정차 → 합류.
 * 아니면 ③ 좌표 있는 정차 + 출발·도착 기준점(등원: 차고지 → … → 학원 / 하원: 학원 → … → 차고지)으로
 * 「추가되는 거리」가 가장 작은 자리. 기준점이 없으면 그 끝은 열린 경로로 본다(맨 앞·맨 뒤에 붙이면 한 구간만 늘어남).
 */
export function suggestPlacement(input: {
  stops: readonly RouteStop[];
  direction: RosterDirection;
  stopName: string;
  student: GeoPoint | null;
  academy: GeoPoint | null;
  depot: GeoPoint | null;
  joinRadiusMeters?: number;
}): PlacementSuggestion {
  const { stops, student } = input;
  const radius = input.joinRadiusMeters ?? JOIN_RADIUS_METERS;
  const skippedNoCoord = stops.filter((s) => !pointOf(s)).map((s) => s.label);
  const end = (reason: string): PlacementSuggestion => ({ choice: { kind: "INSERT", position: stops.length }, arriveTime: null, reason, skippedNoCoord });
  if (stops.length === 0) return end("이 수업·방향에 아직 정차가 없어 첫 정차로 넣습니다.");

  // ① 같은 정류장 이름
  const name = normalizeStopName(input.stopName);
  if (name) {
    const same = stops.findIndex((s) => normalizeStopName(s.label) === name);
    if (same >= 0) {
      return { choice: { kind: "JOIN", stopIndex: same }, arriveTime: stops[same].arriveTime, reason: `「${stops[same].label}」 정류장과 이름이 같아 합류를 추천합니다.`, skippedNoCoord };
    }
  }
  if (!student) return end("학생 위치 좌표가 없어 맨 뒤를 기본으로 둡니다. 지도에서 위치를 지정하면 가까운 자리를 추천합니다.");

  // ② 가까운 정차 합류
  let near = -1, nearD = Infinity;
  stops.forEach((s, i) => {
    const p = pointOf(s);
    if (!p) return;
    const d = dist(p, student);
    if (d <= radius && d < nearD) { near = i; nearD = d; }
  });
  if (near >= 0) {
    return { choice: { kind: "JOIN", stopIndex: near }, arriveTime: stops[near].arriveTime, reason: `「${stops[near].label}」 정류장과 직선 ${Math.round(nearD)}m 거리라 합류를 추천합니다.`, skippedNoCoord };
  }

  // ③ 추가 거리 최소 자리 — 좌표 있는 정차만 잇는다.
  const located = stops.map((s, i) => ({ i, p: pointOf(s) })).filter((x): x is { i: number; p: GeoPoint } => x.p != null);
  if (located.length === 0) return end("운행표 정차에 좌표가 없어 맨 뒤를 기본으로 둡니다.");
  const startPt = input.direction === "BOARD" ? input.depot : input.academy;
  const endPt = input.direction === "BOARD" ? input.academy : input.depot;
  let best = { position: stops.length, added: Infinity };
  for (let k = 0; k <= located.length; k++) {
    const prev = k === 0 ? startPt : located[k - 1].p;
    const next = k === located.length ? endPt : located[k].p;
    let added: number;
    if (prev && next) added = dist(prev, student) + dist(student, next) - dist(prev, next);
    else if (prev) added = dist(prev, student);
    else if (next) added = dist(student, next);
    else added = 0;
    // 원래 목록에서의 자리: 앞 좌표 정차 바로 뒤(맨 앞이면 첫 좌표 정차 바로 앞).
    const position = k === 0 ? located[0].i : located[k - 1].i + 1;
    if (added < best.added - 1e-6) best = { position, added };
  }
  const where = best.position === 0
    ? "첫 정차 앞"
    : best.position >= stops.length ? "맨 뒤" : `${best.position}번 「${stops[best.position - 1].label}」 다음`;
  return {
    choice: { kind: "INSERT", position: best.position },
    arriveTime: estimateInsertTime(stops, best.position, student),
    reason: `${where}에 넣으면 운행 거리가 가장 적게 늘어납니다(직선 약 +${(best.added / 1000).toFixed(1)}km).`,
    skippedNoCoord,
  };
}

/** 등원은 수업 시작 이후, 하원은 수업 종료 이전이면 경고(같은 시각은 정상 — 명단 점검과 같은 기준). */
export function classTimeWarning(direction: RosterDirection, classTime: string, time: string | null): string | null {
  const t = toMin(time);
  const range = parseClassTimeRange(classTime);
  if (t == null || !range) return null;
  if (direction === "BOARD" && t > range.start) return `등원 ${hhmm(time)}이 수업 시작 ${minToHhmm(range.start)}보다 늦습니다.`;
  if (direction === "ALIGHT" && t < range.end) return `하원 ${hhmm(time)}이 수업 종료 ${minToHhmm(range.end)}보다 이릅니다.`;
  return null;
}

/** 화면의 선택 → 서버 요청(삽입 방식 + 기준 행 id). */
export function placementToRequest(stops: readonly RouteStop[], choice: PlacementChoice): { mode: RosterPlacementMode; rowId: string | null } {
  if (choice.kind === "JOIN") {
    const s = stops[choice.stopIndex];
    // 정차의 마지막 학생 행 바로 뒤 → 기사님 화면에서 그 정차 학생 이름 끝에 붙는다.
    const rowId = s?.rows[s.rows.length - 1]?.rowId;
    return rowId ? { mode: "JOIN", rowId } : { mode: "END", rowId: null };
  }
  // 정차 묶음은 「처음 나온 행」 위치에 보인다 → 다음 정차의 첫 행 앞에 넣어야 정확히 그 사이에 보인다.
  const next = stops[choice.position];
  const rowId = next?.rows[0]?.rowId;
  return rowId ? { mode: "BEFORE", rowId } : { mode: "END", rowId: null };
}

/** 원장이 고른 값(덮어쓰기). 없으면 추천을 쓴다. */
export type PlacementOverride = { choice?: PlacementChoice; arriveTime?: string };

export type ResolvedPlacement = {
  stops: DriverStop[];
  suggestion: PlacementSuggestion;
  choice: PlacementChoice;
  isSuggested: boolean;
  /** 이 칸 새 행의 시각(합류면 그 정차 시각). */
  arriveTime: string | null;
  request: { mode: RosterPlacementMode; rowId: string | null };
  warnings: string[];
};

function sameChoice(a: PlacementChoice, b: PlacementChoice): boolean {
  return a.kind === b.kind && (a.kind === "JOIN" ? a.stopIndex === (b as { stopIndex: number }).stopIndex : a.position === (b as { position: number }).position);
}
function validChoice(c: PlacementChoice | undefined, n: number): c is PlacementChoice {
  if (!c) return false;
  return c.kind === "JOIN" ? c.stopIndex >= 0 && c.stopIndex < n : c.position >= 0 && c.position <= n;
}

/**
 * 한 칸의 최종 배정 — 화면 표시와 저장 요청이 **같은 계산**을 쓰게 한곳에 모은다.
 * 시각: 합류 = 정차 시각 / 새 정차 = 원장 입력 > (추천 자리면 추천 시각, 아니면 그 자리 보간 시각).
 */
export function resolveCellPlacement(input: {
  stops: readonly RegularShuttleStop[];
  weekday: number;
  classTime: string;
  direction: RosterDirection;
  stopName: string;
  student: GeoPoint | null;
  academy: GeoPoint | null;
  depot: GeoPoint | null;
  studentId: string | null;
  override?: PlacementOverride;
}): ResolvedPlacement {
  const stops = findRouteCell(input.stops, input.weekday, input.classTime, input.direction);
  const suggestion = suggestPlacement({ stops, direction: input.direction, stopName: input.stopName, student: input.student, academy: input.academy, depot: input.depot });
  const choice = validChoice(input.override?.choice, stops.length) ? input.override!.choice! : suggestion.choice;
  const isSuggested = sameChoice(choice, suggestion.choice);
  let arriveTime: string | null;
  if (choice.kind === "JOIN") arriveTime = stops[choice.stopIndex].arriveTime;
  else if (input.override?.arriveTime !== undefined) arriveTime = input.override.arriveTime || null;
  else arriveTime = isSuggested ? suggestion.arriveTime : estimateInsertTime(stops, choice.position, input.student);

  const warnings: string[] = [];
  const timeWarn = classTimeWarning(input.direction, input.classTime, arriveTime);
  if (timeWarn) warnings.push(timeWarn);
  if (choice.kind === "INSERT") {
    // 기사님 화면은 정류장 이름 글자로 정차를 묶는다 → 같은 이름이 이미 있으면 고른 자리가 아니라 그 정차로 합쳐진다.
    const clash = stops.findIndex((s) => s.label === input.stopName.trim());
    if (clash >= 0) warnings.push(`같은 이름 「${stops[clash].label}」 정차가 이미 있어 고른 자리가 아니라 그 정차로 합쳐집니다. 합류를 고르거나 정류장 이름을 바꿔 주세요.`);
  }
  if (input.studentId && stops.some((s) => s.rows.some((r) => input.stops.some((x) => x.id === r.rowId && x.studentId === input.studentId)))) {
    warnings.push("이 학생이 이미 이 수업·방향 명단에 있습니다(저장하면 거부됩니다).");
  }
  return { stops, suggestion, choice, isSuggested, arriveTime, request: placementToRequest(stops, choice), warnings };
}
