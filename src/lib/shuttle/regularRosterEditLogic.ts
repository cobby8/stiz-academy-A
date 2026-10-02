// 셔틀 명단(RegularShuttleStop) 앱 편집 — 입력 검증·행 생성 규칙(순수 함수, DB 접근 없음).
// 서버(regularRosterEdit.ts)와 화면(RegularShuttleClient)이 같은 규칙을 쓰고, node --test 로 고정한다.
// ⚠️ node 타입 제거 실행으로 테스트하므로 '@/' 경로 import·enum 을 쓰지 않는다.

export type RosterDirection = "BOARD" | "ALIGHT";

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;
export const DIRECTION_LABEL: Record<RosterDirection, string> = { BOARD: "등원", ALIGHT: "하원" };

/** 사용자에게 그대로 보여줄 입력 오류(한국어). API 가 400 으로 돌려준다. */
export class RosterInputError extends Error {}

export type RosterStopInput = {
  stopName: string;
  arriveTime: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type RosterAddInput = {
  serviceMonth: string;
  studentId: string | null;
  studentName: string;
  weekdays: number[];
  classTime: string;
  board: RosterStopInput | null; // null = 등원 셔틀 안 탐
  alight: RosterStopInput | null; // null = 하원 셔틀 안 탐
};

/** 편집 판단에 필요한 기존 행 정보(그 달 전체). */
export type RosterExistingRow = {
  id: string;
  weekday: number;
  direction: string;
  classTime: string | null;
  sortOrder: number;
  studentId: string | null;
  studentName: string | null;
  /** 반이동 시 "같은 학생" 판정용(studentId 없는 이름만 등록 행). 없으면 빈 값으로 본다. */
  parentPhone?: string | null;
};

export type RosterNewRow = {
  weekday: number;
  classTime: string;
  direction: RosterDirection;
  stopName: string;
  arriveTime: string | null;
  latitude: number | null;
  longitude: number | null;
  sortOrder: number;
};

const MAX_IDS = 100;

function obj(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new RosterInputError("요청 형식이 올바르지 않습니다.");
  return raw as Record<string, unknown>;
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function normalizeRosterMonth(v: unknown): string {
  const month = text(v);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new RosterInputError("월은 YYYY-MM 형식이어야 합니다.");
  return month;
}

/** 'YYYY-MM' 다음 달. Date 를 쓰지 않고 문자열 계산만 한다(시간대 무관). */
export function nextServiceMonth(month: string): string {
  const [y, m] = normalizeRosterMonth(month).split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function normalizeWeekday(v: unknown): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 6) throw new RosterInputError("요일이 올바르지 않습니다.");
  return n;
}

/** 요일 여러 개 → 중복 제거·정렬. 하나 이상 필요. */
export function normalizeWeekdays(v: unknown): number[] {
  if (!Array.isArray(v) || v.length === 0) throw new RosterInputError("요일을 하나 이상 선택해 주세요.");
  return [...new Set(v.map(normalizeWeekday))].sort((a, b) => a - b);
}

/** 수업시간 텍스트('17:00~18:00'). 기존 명단과 같은 글자여야 같은 수업으로 묶이므로 공백만 정리한다. */
export function normalizeClassTime(v: unknown): string {
  const t = text(v).replace(/\s*~\s*/g, "~").replace(/\s+/g, " ");
  if (!t) throw new RosterInputError("수업시간을 입력해 주세요.");
  if (t.length > 40) throw new RosterInputError("수업시간이 너무 깁니다.");
  return t;
}

/** 도착 예정시각. 비우면 null, 있으면 'HH:MM' 으로 맞춘다. */
export function normalizeArriveTime(v: unknown): string | null {
  const t = text(v);
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new RosterInputError("도착시각은 17:05 처럼 입력해 주세요.");
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** 좌표는 둘 다 있거나 둘 다 없어야 한다. 한국 범위를 벗어나면 잘못 찍은 것으로 본다. */
export function normalizeCoords(lat: unknown, lng: unknown): { latitude: number | null; longitude: number | null } {
  const empty = (x: unknown) => x == null || x === "";
  if (empty(lat) && empty(lng)) return { latitude: null, longitude: null };
  const la = Number(lat), lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || la < 33 || la > 39 || lo < 124 || lo > 132) {
    throw new RosterInputError("정류장 좌표가 올바르지 않습니다. 지도에서 다시 지정해 주세요.");
  }
  return { latitude: la, longitude: lo };
}

export function normalizeStopInput(raw: unknown, label = "정류장"): RosterStopInput {
  const o = obj(raw);
  const stopName = text(o.stopName);
  if (!stopName) throw new RosterInputError(`${label} 이름을 입력해 주세요.`);
  if (stopName.length > 100) throw new RosterInputError(`${label} 이름이 너무 깁니다.`);
  return { stopName, arriveTime: normalizeArriveTime(o.arriveTime), ...normalizeCoords(o.latitude, o.longitude) };
}

export function validateAddInput(raw: unknown): RosterAddInput {
  const o = obj(raw);
  const studentId = text(o.studentId) || null;
  const studentName = text(o.studentName);
  if (!studentId && !studentName) throw new RosterInputError("학생을 선택하거나 이름을 입력해 주세요.");
  if (studentName.length > 40) throw new RosterInputError("학생 이름이 너무 깁니다.");
  const board = o.board == null ? null : normalizeStopInput(o.board, "등원 정류장");
  const alight = o.alight == null ? null : normalizeStopInput(o.alight, "하원 정류장");
  if (!board && !alight) throw new RosterInputError("등원·하원 중 하나 이상 선택해 주세요.");
  return {
    serviceMonth: normalizeRosterMonth(o.serviceMonth),
    studentId,
    studentName,
    weekdays: normalizeWeekdays(o.weekdays),
    classTime: normalizeClassTime(o.classTime),
    board,
    alight,
  };
}

/** 행 id 목록(삭제·반이동 대상). 중복 제거, 비어 있거나 너무 많으면 거부. */
export function normalizeIds(v: unknown): string[] {
  if (!Array.isArray(v)) throw new RosterInputError("대상 행이 없습니다.");
  const ids = [...new Set(v.map(text).filter(Boolean))];
  if (ids.length === 0) throw new RosterInputError("대상 행이 없습니다.");
  if (ids.length > MAX_IDS) throw new RosterInputError("한 번에 처리할 수 있는 행이 너무 많습니다.");
  return ids;
}

export function validateRemoveInput(raw: unknown): { serviceMonth: string; ids: string[] } {
  const o = obj(raw);
  return { serviceMonth: normalizeRosterMonth(o.serviceMonth), ids: normalizeIds(o.ids) };
}

export function validateMoveInput(raw: unknown): { serviceMonth: string; ids: string[]; weekday: number; classTime: string } {
  const o = obj(raw);
  return {
    serviceMonth: normalizeRosterMonth(o.serviceMonth),
    ids: normalizeIds(o.ids),
    weekday: normalizeWeekday(o.weekday),
    classTime: normalizeClassTime(o.classTime),
  };
}

export function validateStopEditInput(raw: unknown): { serviceMonth: string; id: string; stop: RosterStopInput; applyToAll: boolean } {
  const o = obj(raw);
  const id = text(o.id);
  if (!id) throw new RosterInputError("대상 행이 없습니다.");
  return { serviceMonth: normalizeRosterMonth(o.serviceMonth), id, stop: normalizeStopInput(o.stop), applyToAll: o.applyToAll === true };
}

export function validateCopyInput(raw: unknown): { sourceMonth: string; targetMonth: string } {
  const o = obj(raw);
  const sourceMonth = normalizeRosterMonth(o.sourceMonth);
  const targetMonth = normalizeRosterMonth(o.targetMonth);
  if (sourceMonth === targetMonth) throw new RosterInputError("원본 월과 대상 월이 같습니다.");
  return { sourceMonth, targetMonth };
}

function normName(v: string | null | undefined): string {
  return String(v ?? "").replace(/\s/g, "").toLowerCase();
}

/** 같은 학생의 행인지. studentId 가 있으면 id 로, 없으면(이름만 등록) 이름으로 비교한다. */
export function isSameStudent(row: Pick<RosterExistingRow, "studentId" | "studentName">, studentId: string | null, studentName: string | null): boolean {
  if (studentId) return row.studentId === studentId;
  return !row.studentId && normName(row.studentName) !== "" && normName(row.studentName) === normName(studentName);
}

/**
 * 새 행의 정렬순서 — 그 요일·방향·수업의 마지막 뒤. 그 묶음이 없으면 그 요일 맨 뒤.
 * (가져오기 시 sortOrder 는 요일 안의 시간순 번호다. 뒤 행과 번호가 겹칠 수 있으나 정렬만 동률일 뿐 무해하다.)
 */
export function nextSortOrder(rows: RosterExistingRow[], weekday: number, direction: string, classTime: string): number {
  const day = rows.filter((r) => r.weekday === weekday);
  const group = day.filter((r) => r.direction === direction && (r.classTime ?? "") === classTime);
  const base = group.length > 0 ? group : day;
  return base.length > 0 ? Math.max(...base.map((r) => r.sortOrder)) + 1 : 0;
}

/** 학생 추가 → 생성할 행 목록. 같은 요일·방향·수업에 이미 있으면 중복으로 거부한다. */
export function buildAddRows(input: RosterAddInput, existing: RosterExistingRow[], studentName: string): RosterNewRow[] {
  const work: RosterExistingRow[] = [...existing];
  const out: RosterNewRow[] = [];
  for (const weekday of input.weekdays) {
    for (const [direction, stop] of [["BOARD", input.board], ["ALIGHT", input.alight]] as const) {
      if (!stop) continue;
      const dup = work.some((r) => r.weekday === weekday && r.direction === direction && (r.classTime ?? "") === input.classTime
        && isSameStudent(r, input.studentId, studentName));
      if (dup) {
        throw new RosterInputError(`${studentName} 학생은 ${WEEKDAY_LABELS[weekday]}요일 ${input.classTime} ${DIRECTION_LABEL[direction]}이 이미 명단에 있습니다.`);
      }
      const sortOrder = nextSortOrder(work, weekday, direction, input.classTime);
      out.push({ weekday, classTime: input.classTime, direction, ...stop, sortOrder });
      // 같은 요청 안에서 다음 행이 이 행 뒤로 가도록 작업 목록에도 넣는다.
      work.push({ id: `new-${out.length}`, weekday, direction, classTime: input.classTime, sortOrder, studentId: input.studentId, studentName });
    }
  }
  return out;
}

/**
 * 반이동 → 각 행의 새 요일·수업·정렬순서. 대상 행은 모두 이 달의 학생 등·하원 행이어야 하고,
 * 옮겨 갈 자리에 같은 학생의 같은 방향 행이 이미 있으면 거부한다.
 */
export function buildMoveUpdates(
  ids: string[],
  weekday: number,
  classTime: string,
  existing: RosterExistingRow[],
): { id: string; weekday: number; classTime: string; sortOrder: number }[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const moving = ids.map((id) => byId.get(id));
  if (moving.some((r) => !r || (r.direction !== "BOARD" && r.direction !== "ALIGHT"))) {
    throw new RosterInputError("일부 행을 이 달 명단에서 찾지 못했습니다. 화면을 새로고침해 주세요.");
  }
  const rows = moving as RosterExistingRow[];
  // 한 번의 반이동은 한 학생의 등·하원 행만 옮긴다. 화면이 행을 모을 때 쓰는 키(rosterStudentKey)와 같은 기준으로
  // 확인해, 조작된 요청이 다른 학생 행을 섞어 옮기는 것을 막는다.
  if (new Set(rows.map((r) => rosterStudentKey({ ...r, parentPhone: r.parentPhone ?? null }))).size !== 1) {
    throw new RosterInputError("한 번에 한 학생의 행만 옮길 수 있습니다. 화면을 새로고침해 주세요.");
  }
  if (new Set(rows.map((r) => r.direction)).size !== rows.length) throw new RosterInputError("같은 방향 행을 한꺼번에 옮길 수 없습니다.");
  const idSet = new Set(ids);
  const others = existing.filter((r) => !idSet.has(r.id));
  const work = [...others];
  return rows.map((r) => {
    const clash = others.some((o) => o.weekday === weekday && o.direction === r.direction && (o.classTime ?? "") === classTime
      && isSameStudent(o, r.studentId, r.studentName));
    if (clash) {
      throw new RosterInputError(`${r.studentName ?? "학생"}은 ${WEEKDAY_LABELS[weekday]}요일 ${classTime} ${DIRECTION_LABEL[r.direction as RosterDirection]}이 이미 있습니다.`);
    }
    const sortOrder = nextSortOrder(work, weekday, r.direction, classTime);
    work.push({ ...r, weekday, classTime, sortOrder });
    return { id: r.id, weekday, classTime, sortOrder };
  });
}

// ── 화면 묶음(요일 → 수업시간 → 학생) ─────────────────────────────

export type RosterStopRow = {
  id?: string;
  weekday: number;
  classTime: string | null;
  arriveTime: string | null;
  stopName: string;
  direction: string;
  studentName: string | null;
  studentId?: string | null;
  studentPhone: string | null;
  parentPhone: string | null;
  note: string | null;
  sortOrder: number;
  latitude?: number | null;
  longitude?: number | null;
};

export type RosterStudentEntry<T extends RosterStopRow = RosterStopRow> = {
  key: string;
  studentId: string | null;
  studentName: string;
  parentPhone: string | null;
  studentPhone: string | null;
  board: T | null;
  alight: T | null;
};

/** 학생 식별키: 학생 id 가 있으면 id, 없으면 이름+학부모 전화 끝 4자리. */
export function rosterStudentKey(row: Pick<RosterStopRow, "studentId" | "studentName" | "parentPhone">): string {
  if (row.studentId) return `id:${row.studentId}`;
  return `name:${normName(row.studentName)}|${String(row.parentPhone ?? "").replace(/\D/g, "").slice(-4)}`;
}

/** 한 요일의 학생 등·하원 행을 수업시간별 학생 목록으로 묶는다(PIVOT·RETURN 같은 운영 정차는 제외). */
export function groupRosterDay<T extends RosterStopRow>(stops: T[], weekday: number): { classTime: string; students: RosterStudentEntry<T>[] }[] {
  const classes = new Map<string, Map<string, RosterStudentEntry<T>>>();
  for (const s of stops) {
    if (s.weekday !== weekday || !s.studentName || (s.direction !== "BOARD" && s.direction !== "ALIGHT")) continue;
    const ct = s.classTime ?? "";
    const students = classes.get(ct) ?? new Map<string, RosterStudentEntry<T>>();
    classes.set(ct, students);
    const key = rosterStudentKey(s);
    const entry = students.get(key) ?? {
      key, studentId: s.studentId ?? null, studentName: s.studentName, parentPhone: s.parentPhone, studentPhone: s.studentPhone, board: null, alight: null,
    };
    if (s.direction === "BOARD") entry.board = entry.board ?? s;
    else entry.alight = entry.alight ?? s;
    entry.parentPhone = entry.parentPhone ?? s.parentPhone;
    entry.studentPhone = entry.studentPhone ?? s.studentPhone;
    students.set(key, entry);
  }
  return [...classes.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map(([classTime, students]) => ({
      classTime,
      students: [...students.values()].sort((a, b) => a.studentName.localeCompare(b.studentName, "ko")),
    }));
}

/** 그 달 명단에서 한 학생의 모든 등·하원 행 id(「이 달 전체 빼기」용). */
export function rosterRowIdsForStudent(stops: RosterStopRow[], key: string): string[] {
  return stops
    .filter((s) => s.id && s.studentName && (s.direction === "BOARD" || s.direction === "ALIGHT") && rosterStudentKey(s) === key)
    .map((s) => s.id as string);
}
