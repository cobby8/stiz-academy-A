/**
 * 방학특강 정규 수강일 좌석 재동기화용 "순수 계산" 모듈.
 *
 * 이 파일은 의도적으로 아무것도 import 하지 않는다(DB도, 다른 모듈도).
 * 반 이동·요일 변경 때 무엇을 넣고/거두고/되살릴지는 순수 계산으로 먼저 결정하고,
 * 실제 DB 반영은 enrollment-dates.ts 가 안전 조건(WHERE)과 함께 수행한다.
 */

export type EnrollmentSlotSnapshot = {
  sessionDateId: string;
  /** REGULAR | MAKEUP */
  kind: string;
  /** SCHEDULED | CANCELLED | MOVED */
  status: string;
  /** null 이면 아직 출결 미확인 = 자동 정리 가능 */
  attendanceStatus: string | null;
};

export type EnrollmentDatesDiff = {
  /** 새로 만들어야 하는 회차 (아직 좌석 행이 아예 없는 날) */
  toInsert: string[];
  /** 거둬야 하는 회차 (옛 반·옛 요일 좌석 → 소프트 취소) */
  toCancel: string[];
  /** 되살려야 하는 회차 (A반→B반→A반 되돌리기 대응) */
  toRevive: string[];
  /** 출결이 찍혀 있어 거두지 못한 회차 (이동은 막지 않되 기록으로 남긴다) */
  blockedByAttendance: string[];
};

/**
 * 현재 좌석과 목표 회차를 비교해 변경 계획을 만든다. DB를 건드리지 않는다.
 *
 * 규칙
 * - `attendanceStatus` 가 있는 좌석은 어떤 경우에도 취소·복구 대상이 아니다(출결 불가침).
 * - `kind='MAKEUP'` 좌석은 정규 재동기화 대상이 아니다. 보강은 보강 취소 경로에서만 정리한다.
 * - 목표 회차에 이미 어떤 좌석(보강 포함)이 있으면 새로 넣지 않는다
 *   (유니크키 (applicationItemId, sessionDateId) 충돌 방지).
 */
export function diffEnrollmentDates(
  current: EnrollmentSlotSnapshot[],
  targetSessionDateIds: string[],
): EnrollmentDatesDiff {
  const target = new Set(targetSessionDateIds.filter(Boolean));
  const existing = new Set(current.map((slot) => slot.sessionDateId));

  const toInsert: string[] = [];
  for (const sessionDateId of target) {
    if (!existing.has(sessionDateId)) toInsert.push(sessionDateId);
  }

  const toCancel: string[] = [];
  const toRevive: string[] = [];
  const blockedByAttendance: string[] = [];
  for (const slot of current) {
    if (slot.kind !== "REGULAR") continue; // 보강 좌석은 손대지 않는다.
    const wanted = target.has(slot.sessionDateId);
    const cancelled = slot.status === "CANCELLED";
    if (!wanted && !cancelled) {
      // 출결이 찍힌 좌석은 거두지 않는다. 대신 몇 건인지 보고한다.
      if (slot.attendanceStatus != null) blockedByAttendance.push(slot.sessionDateId);
      else toCancel.push(slot.sessionDateId);
      continue;
    }
    if (wanted && cancelled && slot.attendanceStatus == null) toRevive.push(slot.sessionDateId);
  }

  return { toInsert, toCancel, toRevive, blockedByAttendance };
}
