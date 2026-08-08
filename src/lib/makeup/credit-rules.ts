// 보강권 규칙 — 부수효과·DB 접근이 전혀 없는 순수 모듈.
//
// 왜 따로 떼는가(dispatchReconcile.ts 와 같은 이유):
//   보강권은 학부모의 권리이고 돈과 직결된다. 만료를 하루 잘못 계산하면
//   "쓸 수 있던 보강권이 사라졌다"는 분쟁이 된다. node --test 로 실제 돌려 보고
//   검증할 수 있어야 해서, DB에 붙지 않은 순수 함수로 분리한다.
//
// 근거 — 2026-08-09 개정 이용약관 「수업의 보강」
//   · 결석 1회당 보강권 1회 발급
//   · 결석이 발생한 날로부터 2개월 이내 사용, 지나면 자동 소멸
//   · 예약 후 무단 불참 시 사용한 것으로 처리
//   · 미리 취소하면 보강권 유지
//   · 학년이 맞는 다른 수업, 정원 +2 까지

export type MakeupSourceType = "REGULAR" | "SEASONAL";

export type MakeupCreditStatus =
  | "AVAILABLE" // 사용 가능
  | "RESERVED"  // 보강 예약됨
  | "USED"      // 참석 완료
  | "NO_SHOW"   // 무단 불참 — 약관상 사용한 것으로 처리
  | "EXPIRED"   // 2개월 경과 소멸
  | "REVOKED";  // 결석이 취소되어 회수

/** 아직 쓸 수 있는(잔여로 세는) 상태. */
export const OPEN_STATUSES: MakeupCreditStatus[] = ["AVAILABLE", "RESERVED"];

/** 이미 소진되어 되돌릴 수 없는 상태. */
export const CLOSED_STATUSES: MakeupCreditStatus[] = ["USED", "NO_SHOW", "EXPIRED", "REVOKED"];

/**
 * 중복 발급 방지용 자연키.
 *
 * 출결을 결석→출석→결석으로 여러 번 바꿔도 **한 결석에 보강권은 한 장**이어야 한다.
 * 이 키에 유니크 인덱스가 걸려 있어 DB가 최종 방어선 역할을 한다.
 */
export function makeSourceKey(input:
  | { sourceType: "REGULAR"; classId: string; absenceYmd: string }
  | { sourceType: "SEASONAL"; enrollmentDateId: string },
): string {
  if (input.sourceType === "REGULAR") return `REGULAR:${input.classId}:${input.absenceYmd}`;
  return `SEASONAL:${input.enrollmentDateId}`;
}

/**
 * 만료 시각 — **결석일로부터** 2개월. 발급일이 아니다.
 *
 * 약관이 "결석이 발생한 날로부터 2개월"이라고 못 박고 있다. 출결을 늦게 입력했다고
 * 학부모가 손해 보거나 이득 보면 안 되므로 발급 시점과 무관하게 결석일로 계산한다.
 *
 * 말일 보정: 12/31 결석 → 2/31 은 없으므로 2월 말일로 맞춘다(JS Date 는 3/3 으로 넘어간다).
 */
export function calcExpiry(absenceDate: Date, months = 2): Date {
  const d = new Date(absenceDate.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);                       // 말일 넘침 방지: 먼저 1일로
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** 그 시점에 만료됐는가. 경계(정확히 같은 순간)는 아직 유효로 본다 — 학부모에게 유리하게. */
export function isExpired(credit: { expiresAt: Date; status: MakeupCreditStatus }, now: Date): boolean {
  if (CLOSED_STATUSES.includes(credit.status)) return false; // 이미 끝난 건 만료 대상이 아니다
  return credit.expiresAt.getTime() < now.getTime();
}

/** 지금 예약에 쓸 수 있는가. */
export function isUsable(credit: { expiresAt: Date; status: MakeupCreditStatus }, now: Date): boolean {
  return credit.status === "AVAILABLE" && !isExpired(credit, now);
}

export type CreditCounts = { available: number; reserved: number; used: number; expired: number };

/** 학부모 화면에 보여줄 잔여 집계. 만료가 아직 반영 안 된 건도 지금 시점으로 판정한다. */
export function summarize(
  credits: { expiresAt: Date; status: MakeupCreditStatus }[],
  now: Date,
): CreditCounts {
  const out: CreditCounts = { available: 0, reserved: 0, used: 0, expired: 0 };
  for (const c of credits) {
    if (c.status === "USED" || c.status === "NO_SHOW") out.used++;
    else if (c.status === "EXPIRED" || c.status === "REVOKED") out.expired++;
    else if (isExpired(c, now)) out.expired++;   // 크론이 아직 안 돌았어도 화면엔 만료로 보인다
    else if (c.status === "RESERVED") out.reserved++;
    else out.available++;
  }
  return out;
}

export type ClassCandidate = {
  classId: string;
  className: string;
  dayOfWeek: string;
  startTime: string;
  /** 시간표에 등록된 수업별 학년 구성. 예: ["초4","초5","초6","중1"] */
  grades: string[];
  capacity: number;
  /** 정규 수강생 수 */
  enrolled: number;
  /** 이미 잡힌 보강 예약 수 */
  booked: number;
};

/** 보강은 정원 +2 까지 받는다(2026-08-09 개정 약관). */
export const MAKEUP_OVER_CAPACITY = 2;

export function remainingSeats(c: Pick<ClassCandidate, "capacity" | "enrolled" | "booked">): number {
  return c.capacity + MAKEUP_OVER_CAPACITY - (c.enrolled + c.booked);
}

/**
 * 학생 학년으로 보강 가능한 반을 고른다.
 *
 * 학년 판정은 **시간표에 등록된 수업별 학년 구성**(ScheduleSlot.gradesJSON)을 그대로 쓴다.
 * 학생 학년 표기("초5")와 값이 동일해 별도 변환이 필요 없다.
 * 프로그램의 대상연령("초등저~고 (일부 중학생 가능)")은 자유 문장이라 절대 파싱하지 않는다.
 *
 * 정렬: 자리 여유가 많은 순 → 요일·시각 순. 여유 있는 반을 먼저 권해 특정 반 쏠림을 막는다.
 */
export function recommendClasses(
  candidates: ClassCandidate[],
  studentGrade: string | null,
  opts: { excludeClassId?: string | null } = {},
): (ClassCandidate & { remaining: number })[] {
  const grade = (studentGrade ?? "").trim();
  if (!grade) return [];
  return candidates
    .filter((c) => c.classId !== opts.excludeClassId)
    .filter((c) => c.grades.includes(grade))
    .map((c) => ({ ...c, remaining: remainingSeats(c) }))
    .filter((c) => c.remaining > 0)
    .sort((a, b) =>
      b.remaining - a.remaining ||
      a.dayOfWeek.localeCompare(b.dayOfWeek) ||
      a.startTime.localeCompare(b.startTime));
}
