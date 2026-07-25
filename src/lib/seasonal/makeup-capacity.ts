import { prisma } from "@/lib/prisma";
import { SEASONAL_WEEKDAYS, type SeasonalWeekday } from "@/lib/seasonal/contracts";
import { normalizeWeekdayKeys } from "@/lib/seasonal/enrollment-dates";
import { weekdayInSeoul } from "@/lib/seasonal/planning";

/**
 * 방학특강 보강 정원 판정 라이브러리.
 *
 * 배경: 승인(`ensureSpecialProgramOperationalCapacity`)은 "linkedClass 형제 반 그룹 × 요일" 기준으로
 * 정원을 보는데, 보강 배정만 "그 반의 그 날짜" 기준으로 따로 셌다. 같은 교실을 두 잣대로 재던 셈이라
 * 승인은 막히는데 보강은 통과하는 모순이 생겼다. 이 파일이 보강 쪽 기준을 승인과 같게 맞춘다.
 *
 * 안전 원칙
 * - PgBouncer 트랜잭션 모드 때문에 Prisma ORM 메서드 대신 $queryRawUnsafe 를 쓴다.
 * - 좌석 조회는 항상 `SpecialProgramApplicationItem.status = 'APPROVED'` 로 거른다(거절·취소 학생 제외).
 * - 요일 판정은 반드시 서울시간(Asia/Seoul) 기준.
 */

/** 승인 경로(route.ts APPROVED_SEAT_STATUSES)와 같은 값을 유지해야 한다. */
export const MAKEUP_SEAT_ITEM_STATUSES = ["APPROVED"] as const;

export type GroupSeatItem = { id: string; selectedWeekdays: string[] | null };

/**
 * [순수 함수] 형제 반 그룹의 요일별 정규 좌석 점유 수를 센다.
 * - 같은 항목이 두 번 들어와도 1명으로 센다(승인 경로의 COUNT(DISTINCT item.id) 와 동일).
 * - selectedWeekdays 가 비었으면 "전 요일 참석"으로 본다
 *   (승인 경로의 `COALESCE(cardinality(...),0) = 0` 규칙과 반드시 같은 의미를 유지한다).
 */
export function countGroupOccupancyByWeekday(items: GroupSeatItem[]): Record<SeasonalWeekday, number> {
  const counts = Object.fromEntries(SEASONAL_WEEKDAYS.map((weekday) => [weekday, 0])) as Record<SeasonalWeekday, number>;
  const seen = new Set<string>();
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    const wanted = normalizeWeekdayKeys(item.selectedWeekdays);
    const days: readonly SeasonalWeekday[] = wanted.length > 0 ? wanted : SEASONAL_WEEKDAYS;
    for (const day of days) counts[day] += 1;
  }
  return counts;
}

export type SeasonalMakeupRoom = {
  sessionDateId: string;
  weekday: SeasonalWeekday;
  /** 반 정원(null = 정원 무제한) */
  capacity: number | null;
  /** 그룹 × 요일 기준 정규 수강생 수 */
  regularOccupied: number;
  /** 그 날짜에 이미 배정된 활성 보강 인원 */
  makeupOccupied: number;
  /** 화면 표시용 합계 */
  filled: number;
  /** 남은 자리(정원 무제한이면 null, 음수 가능) */
  remaining: number | null;
  /** 보강을 더 받을 수 있는가 */
  hasRoom: boolean;
  /** 이 요일은 정규 인원만으로 이미 정원을 넘긴 상태인가(운영상 허용된 초과) */
  overCapacityBaseline: boolean;
};

/**
 * [순수 함수] 정원 여유 판정.
 *
 * 운영 규칙(사용자 확인 완료):
 * - 정원이 없으면(무제한) 항상 허용.
 * - 정규 인원만으로 이미 정원을 넘긴 반(예: 초등 고학년 월 15명 / 정원 12)은 **경고만 하고 보강을 허용**한다.
 *   여기서 막아버리면 이미 초과 중인 반은 보강이 영구히 불가능해져 운영이 마비된다.
 * - 아직 여유가 있는 반은 (정규 + 이미 배정된 보강) 이 정원에 닿는 순간부터 막는다.
 */
export function decideMakeupRoom(params: {
  capacity: number | null;
  regularOccupied: number;
  makeupOccupied: number;
}): { hasRoom: boolean; overCapacityBaseline: boolean; remaining: number | null } {
  const { capacity, regularOccupied, makeupOccupied } = params;
  if (capacity == null) return { hasRoom: true, overCapacityBaseline: false, remaining: null };
  const remaining = capacity - (regularOccupied + makeupOccupied);
  if (regularOccupied >= capacity) {
    // 이미 초과 중인 반 — 막지 않고 통과시키되 호출부에서 경고 로그를 남긴다.
    return { hasRoom: true, overCapacityBaseline: true, remaining };
  }
  return { hasRoom: remaining > 0, overCapacityBaseline: false, remaining };
}

/** IN 절 플레이스홀더 ($2,$3,...) 를 만든다. 배열 파라미터는 simple query protocol 에서 불안정하므로 쓰지 않는다. */
function placeholders(count: number, startIndex: number) {
  return Array.from({ length: count }, (_, index) => `$${startIndex + index}`).join(",");
}

/**
 * 특강 회차 날짜별 보강 여유를 계산한다.
 * 반환: sessionDateId → 여유 정보 맵.
 */
export async function loadSeasonalMakeupRooms(
  offeringId: string,
  sessionDateIds: string[],
): Promise<Map<string, SeasonalMakeupRoom>> {
  const result = new Map<string, SeasonalMakeupRoom>();
  const uniqueIds = Array.from(new Set(sessionDateIds.filter(Boolean)));
  if (uniqueIds.length === 0) return result;

  // 1) 기준 반의 그룹 스코프(같은 시즌 + 같은 linkedClass) 와 정원을 읽는다.
  const offeringRows = await prisma.$queryRawUnsafe<Array<{
    id: string; seasonId: string; linkedClassId: string | null; capacity: number | null;
  }>>(
    `SELECT o.id, o."seasonId", o."linkedClassId", o.capacity
       FROM "SpecialProgramOffering" o
      WHERE o.id = $1
      LIMIT 1`,
    offeringId,
  );
  const offering = offeringRows[0];
  if (!offering) return result;
  const capacity = offering.capacity == null ? null : Number(offering.capacity);

  // 2) 그룹에 속한 승인 좌석(신청 항목 + 신청서 요일)을 모아 요일별로 센다.
  // linkedClass 가 있으면 형제 반 전체, 없으면 그 반 하나만 스코프로 잡는다(승인 경로와 동일).
  const groupScopeSql = offering.linkedClassId
    ? `candidate."seasonId" = $1 AND candidate."linkedClassId" = $2`
    : `candidate.id = $1`;
  const groupParams: string[] = offering.linkedClassId
    ? [offering.seasonId, offering.linkedClassId]
    : [offering.id];
  const seatRows = await prisma.$queryRawUnsafe<Array<{ id: string; selectedWeekdays: string[] | null }>>(
    `SELECT item.id, app."selectedWeekdays" AS "selectedWeekdays"
       FROM "SpecialProgramApplicationItem" item
       JOIN "SpecialProgramOffering" candidate ON candidate.id = item."offeringId"
       JOIN "SpecialProgramApplication" app ON app.id = item."applicationId"
      WHERE item.status IN ('${MAKEUP_SEAT_ITEM_STATUSES.join("','")}')
        AND ${groupScopeSql}`,
    ...groupParams,
  );
  const occupancyByWeekday = countGroupOccupancyByWeekday(seatRows);

  // 3) 대상 회차 날짜의 요일을 구한다(서울시간 기준).
  const sessionRows = await prisma.$queryRawUnsafe<Array<{ id: string; startsAt: Date | string }>>(
    `SELECT sd.id, sd."startsAt"
       FROM "SpecialProgramSessionDate" sd
      WHERE sd.id IN (${placeholders(uniqueIds.length, 1)})`,
    ...uniqueIds,
  );

  // 4) 각 날짜에 이미 배정된 활성 보강 인원을 센다(거절·취소된 신청 항목은 제외).
  const makeupRows = await prisma.$queryRawUnsafe<Array<{ sessionDateId: string; cnt: number | bigint }>>(
    `SELECT e."sessionDateId" AS "sessionDateId", COUNT(*)::int AS cnt
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramApplicationItem" it ON it.id = e."applicationItemId"
      WHERE e."sessionDateId" IN (${placeholders(uniqueIds.length, 1)})
        AND e.kind = 'MAKEUP'
        AND e.status <> 'CANCELLED'
        AND it.status = 'APPROVED'
      GROUP BY e."sessionDateId"`,
    ...uniqueIds,
  );
  const makeupCountById = new Map<string, number>(makeupRows.map((row) => [row.sessionDateId, Number(row.cnt) || 0]));

  for (const session of sessionRows) {
    const startsAt = session.startsAt instanceof Date ? session.startsAt : new Date(session.startsAt);
    if (Number.isNaN(startsAt.getTime())) continue;
    const weekday = weekdayInSeoul(startsAt);
    const regularOccupied = occupancyByWeekday[weekday] ?? 0;
    const makeupOccupied = makeupCountById.get(session.id) ?? 0;
    const decision = decideMakeupRoom({ capacity, regularOccupied, makeupOccupied });
    result.set(session.id, {
      sessionDateId: session.id,
      weekday,
      capacity,
      regularOccupied,
      makeupOccupied,
      filled: regularOccupied + makeupOccupied,
      remaining: decision.remaining,
      hasRoom: decision.hasRoom,
      overCapacityBaseline: decision.overCapacityBaseline,
    });
  }
  return result;
}
