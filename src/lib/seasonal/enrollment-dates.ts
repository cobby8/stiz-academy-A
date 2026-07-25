import { prisma } from "@/lib/prisma";
import { SEASONAL_WEEKDAYS, type SeasonalWeekday } from "@/lib/seasonal/contracts";
import { weekdayInSeoul } from "@/lib/seasonal/planning";

/**
 * 방학특강 정규 수강일(kind='REGULAR') 슬롯 생성 라이브러리.
 *
 * 배경: 지금까지 승인 경로에 REGULAR 슬롯을 만드는 코드가 없어서, 날짜별 출석부에
 * 학생이 나타나지 않았다(운영자가 수동 백필로 메워 왔다). 이 파일이 그 구멍을 메운다.
 *
 * 안전 원칙 (절대 위반 금지)
 * - INSERT ... ON CONFLICT DO NOTHING 만 사용한다. DO UPDATE 를 쓰면 이미 배정된
 *   보강 슬롯(kind='MAKEUP')이 REGULAR 로 덮어써져 보강 배정이 사라진다.
 * - 기존 행을 UPDATE / DELETE 하지 않는다. "누락분 채우기"만 한다.
 * - 요일이 바뀌었을 때 기존 슬롯을 지우는 로직은 넣지 않는다(출결 기록 소실 위험).
 * - PgBouncer 트랜잭션 모드 때문에 Prisma ORM 메서드 대신 $queryRawUnsafe / $executeRawUnsafe 를 쓴다.
 */

// 예전 데이터에 한글/풀네임 요일이 섞여 있어 관대하게 정규화한다(알 수 없는 값은 조용히 무시).
const WEEKDAY_ALIASES: Record<string, SeasonalWeekday> = {
  MON: "MON", MONDAY: "MON", 월: "MON", 월요일: "MON",
  TUE: "TUE", TUESDAY: "TUE", 화: "TUE", 화요일: "TUE",
  WED: "WED", WEDNESDAY: "WED", 수: "WED", 수요일: "WED",
  THU: "THU", THURSDAY: "THU", 목: "THU", 목요일: "THU",
  FRI: "FRI", FRIDAY: "FRI", 금: "FRI", 금요일: "FRI",
  SAT: "SAT", SATURDAY: "SAT", 토: "SAT", 토요일: "SAT",
  SUN: "SUN", SUNDAY: "SUN", 일: "SUN", 일요일: "SUN",
};

export type SessionDateLike = { id: string; startsAt: Date | string };

/** 신청서에 저장된 요일 값을 MON~SUN 표준 키로 정리한다. 잘못된 값은 버린다. */
export function normalizeWeekdayKeys(values: unknown): SeasonalWeekday[] {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map((value) => WEEKDAY_ALIASES[String(value ?? "").trim().toUpperCase()])
    .filter((weekday): weekday is SeasonalWeekday => Boolean(weekday));
  // 입력 순서와 무관하게 항상 월~일 순서로 정렬해 결과를 예측 가능하게 만든다.
  return SEASONAL_WEEKDAYS.filter((weekday) => normalized.includes(weekday));
}

/**
 * 특강 전체 회차 중 학생이 실제로 나오는 날짜만 고른다.
 * - selectedWeekdays 가 비었거나 알 수 없는 값뿐이면 => 전 회차(주5회/구 데이터 대응).
 * - 요일 판정은 반드시 서울시간(Asia/Seoul) 기준. UTC로 판정하면 밤 수업이 전날 요일로 밀린다.
 */
export function pickSessionDatesForWeekdays<T extends SessionDateLike>(
  sessionDates: T[],
  selectedWeekdays: unknown,
): T[] {
  const wanted = normalizeWeekdayKeys(selectedWeekdays);
  if (wanted.length === 0) return [...sessionDates];
  return sessionDates.filter((sessionDate) => {
    const startsAt = sessionDate.startsAt instanceof Date ? sessionDate.startsAt : new Date(sessionDate.startsAt);
    if (Number.isNaN(startsAt.getTime())) return false;
    return wanted.includes(weekdayInSeoul(startsAt));
  });
}

export type SyncEnrollmentDatesResult = {
  /** 실제로 처리했는지 (APPROVED 아님/회차 없음 등이면 false) */
  applied: boolean;
  /** 이 학생이 나와야 하는 날짜 수 */
  matchedCount: number;
  /** 이번 실행에서 새로 만들어진 슬롯 수 (두 번째 실행부터는 0이어야 정상 = 멱등) */
  insertedCount: number;
  reason?: "ITEM_NOT_FOUND" | "ITEM_NOT_APPROVED" | "NO_SESSION_DATES" | "NO_MATCHED_DATES";
};

/**
 * 승인된 신청 항목에 대해 정규 수강일(kind='REGULAR') 슬롯을 채운다.
 * 여러 번 실행해도 안전하다(ON CONFLICT DO NOTHING 이라 중복도 변경도 없다).
 */
export async function syncEnrollmentDatesForItem(applicationItemId: string): Promise<SyncEnrollmentDatesResult> {
  // 1) 신청 항목 + 신청서의 선택 요일 + (전환 완료된 경우) 학생 ID 를 한 번에 읽는다.
  const itemRows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    offeringId: string;
    status: string;
    selectedWeekdays: string[] | null;
    studentId: string | null;
  }>>(
    `SELECT it.id,
            it."offeringId",
            it.status,
            app."selectedWeekdays" AS "selectedWeekdays",
            en."studentId" AS "studentId"
       FROM "SpecialProgramApplicationItem" it
       JOIN "SpecialProgramApplication" app ON app.id = it."applicationId"
       LEFT JOIN "Enrollment" en ON en.id = it."enrollmentId"
      WHERE it.id = $1
      LIMIT 1`,
    applicationItemId,
  );
  const item = itemRows[0];
  if (!item) return { applied: false, matchedCount: 0, insertedCount: 0, reason: "ITEM_NOT_FOUND" };
  // 승인된 항목만 좌석을 깐다. 대기/거절/취소 항목은 출석부에 나오면 안 된다.
  if (item.status !== "APPROVED") {
    return { applied: false, matchedCount: 0, insertedCount: 0, reason: "ITEM_NOT_APPROVED" };
  }

  // 2) 이 특강(offering)의 전체 회차 날짜를 가져온다.
  const sessionDates = await prisma.$queryRawUnsafe<Array<{ id: string; startsAt: Date | string }>>(
    `SELECT sd.id, sd."startsAt"
       FROM "SpecialProgramSessionDate" sd
      WHERE sd."offeringId" = $1
      ORDER BY sd."startsAt" ASC`,
    item.offeringId,
  );
  if (sessionDates.length === 0) {
    // 특강에 회차 날짜가 하나도 없으면 좌석을 만들 수 없다. 조용히 넘어가면 "승인했는데 출석부가 비어 있다"를
    // 아무도 눈치채지 못하므로 경고 로그를 남긴다. (반환값·동작은 그대로)
    console.warn(
      "[seasonal enrollment-dates] 좌석 생성 건너뜀: 특강에 회차 날짜가 없습니다.",
      { applicationItemId, offeringId: item.offeringId, reason: "NO_SESSION_DATES" },
    );
    return { applied: false, matchedCount: 0, insertedCount: 0, reason: "NO_SESSION_DATES" };
  }

  // 3) 학생이 신청한 요일과 겹치는 날짜만 고른다(서울시간 기준).
  const matched = pickSessionDatesForWeekdays(sessionDates, item.selectedWeekdays);
  if (matched.length === 0) {
    // 신청 요일과 겹치는 회차가 하나도 없는 경우(예: 화·목 신청인데 특강이 월·수만 열림).
    // 운영자가 요일 설정을 확인할 수 있도록 신청 요일 값까지 함께 남긴다.
    console.warn(
      "[seasonal enrollment-dates] 좌석 생성 건너뜀: 신청 요일과 겹치는 회차가 없습니다.",
      {
        applicationItemId,
        offeringId: item.offeringId,
        selectedWeekdays: item.selectedWeekdays,
        sessionDateCount: sessionDates.length,
        reason: "NO_MATCHED_DATES",
      },
    );
    return { applied: false, matchedCount: 0, insertedCount: 0, reason: "NO_MATCHED_DATES" };
  }

  // 4) 누락된 슬롯만 채운다.
  //    - 파라미터: $1=신청항목, $2=특강, $3=학생(없으면 null), $4.. = 회차 날짜 ID들
  //    - ON CONFLICT DO NOTHING: 이미 있는 행(REGULAR/MAKEUP 무관)은 절대 건드리지 않는다.
  const params: Array<string | null> = [item.id, item.offeringId, item.studentId ?? null, ...matched.map((row) => row.id)];
  const valuesSql = matched.map((_, index) => `($1,$2,$${index + 4},$3,'REGULAR','SCHEDULED')`).join(",");
  const insertedCount = await prisma.$executeRawUnsafe(
    `INSERT INTO "SpecialProgramEnrollmentDate"
       ("applicationItemId","offeringId","sessionDateId","studentId","kind","status")
     VALUES ${valuesSql}
     ON CONFLICT ("applicationItemId","sessionDateId") DO NOTHING`,
    ...params,
  );

  return { applied: true, matchedCount: matched.length, insertedCount: Number(insertedCount) || 0 };
}

/**
 * 승인 처리 흐름에서 쓰는 안전 래퍼.
 * 슬롯 생성이 실패해도 승인 자체는 성공으로 유지해야 하므로 예외를 삼키고 로그만 남긴다.
 */
export async function syncEnrollmentDatesForItemSafe(applicationItemId: string): Promise<SyncEnrollmentDatesResult | null> {
  try {
    return await syncEnrollmentDatesForItem(applicationItemId);
  } catch (error) {
    console.error("[seasonal enrollment-dates sync]", applicationItemId, error);
    return null;
  }
}
