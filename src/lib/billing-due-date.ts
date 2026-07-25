/**
 * 수강료 납부기한 계산 — 이용약관 기준 (2026-07-26 신설)
 *
 * ── 약관 원문 (AcademySettings.termsOfService / `/terms`) ──────────────────
 * "스티즈농구교실 다산점 수강료는 수강을 시작하기 2주 전부터 수강일 전까지 납부 받습니다.
 *  수강 개시일 2주전부터 1주일 간은 우선등록 기간으로, 대기 수강생이 있는 경우
 *  우선 등록 기간에 수강료 납부를 해주셔야 합니다.
 *  수강 개시일 1주전부터는 신규 및 일반등록기간으로 (...)"
 *
 * ── 이 파일이 존재하는 이유 ────────────────────────────────────────────────
 * 기존에는 "매월 10일"이 세 군데(시트 이관 / 시트 대사 / 월별 청구 생성)에
 * 각각 하드코딩되어 있었고, 약관과 정반대(수강 시작 후 10일)였다.
 * 계산을 이 순수 함수 한 곳으로 모아서 규칙이 바뀌어도 한 곳만 고치면 되게 한다.
 *
 * ── 타임존 주의 ────────────────────────────────────────────────────────────
 * 모든 함수는 `YYYY-MM-DD` **문자열**을 반환한다. JS `Date` 객체를 그대로 DB에
 * 넣으면 한국시간 자정이 UTC 전날 15시로 저장되어 기한이 하루 앞당겨진다.
 * (실제로 7월 청구 일부가 07-09로 저장되어 하루 일찍 연체 처리되고 있었다.)
 * 문자열을 `::timestamp`로 캐스팅해 넣으면 항상 그 날짜 00:00으로 저장된다.
 */

/** 우선등록 기간 시작: 수강 개시일 2주(14일) 전 */
export const PRIORITY_REGISTRATION_DAYS_BEFORE = 14;

/** 신규·일반등록 기간 시작: 수강 개시일 1주(7일) 전 */
export const GENERAL_REGISTRATION_DAYS_BEFORE = 7;

/**
 * 최종 납부기한: 수강 개시일 "전날".
 * 약관의 "수강일 전까지"를 날짜 단위로 옮긴 값이다.
 */
export const DUE_DATE_DAYS_BEFORE_START = 1;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` 문자열 → UTC 기준 epoch(ms). 날짜 계산 전용(시:분:초 없음). */
function parseIsoDate(isoDate: string): number {
    const matched = ISO_DATE_PATTERN.exec(isoDate);
    if (!matched) {
        throw new Error(`날짜 형식이 올바르지 않습니다(YYYY-MM-DD 필요): ${isoDate}`);
    }
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    const utcMs = Date.UTC(year, month - 1, day);
    const roundTrip = new Date(utcMs);
    // 2026-02-31 같은 존재하지 않는 날짜를 조용히 넘기지 않는다.
    if (
        roundTrip.getUTCFullYear() !== year ||
        roundTrip.getUTCMonth() !== month - 1 ||
        roundTrip.getUTCDate() !== day
    ) {
        throw new Error(`존재하지 않는 날짜입니다: ${isoDate}`);
    }
    return utcMs;
}

/** epoch(ms) → `YYYY-MM-DD` */
function formatIsoDate(utcMs: number): string {
    return new Date(utcMs).toISOString().slice(0, 10);
}

/** 날짜에서 일수를 뺀다(음수면 더한다). */
function shiftDays(isoDate: string, days: number): string {
    return formatIsoDate(parseIsoDate(isoDate) - days * MS_PER_DAY);
}

function assertYearMonth(year: number, month: number): void {
    if (!Number.isInteger(year) || year < 2000 || year > 2999) {
        throw new Error(`연도가 올바르지 않습니다: ${year}`);
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error(`월이 올바르지 않습니다: ${month}`);
    }
}

/**
 * 월 단위 수강의 "수강 개시일".
 *
 * 정규반은 월 단위로 등록·청구하고, 그 달의 수업권은 1일부터 말일까지 유효하다.
 * 반별 첫 수업일(요일 기준)을 쓰지 않는 이유는 아래 "반별 첫 수업일을 쓰지 않는 이유" 참고.
 */
export function monthlyCourseStartDate(year: number, month: number): string {
    assertYearMonth(year, month);
    return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * 임의의 수강 개시일에 대한 최종 납부기한(= 개시일 전날).
 * 특강처럼 개시일이 명확한 상품에도 그대로 쓸 수 있다.
 */
export function dueDateForCourseStart(courseStartDate: string): string {
    return shiftDays(courseStartDate, DUE_DATE_DAYS_BEFORE_START);
}

/**
 * 월 단위 수강료의 최종 납부기한.
 * 결과는 항상 **전월 말일**이다. (예: 2026년 8월분 → 2026-07-31)
 */
export function monthlyBillingDueDate(year: number, month: number): string {
    return dueDateForCourseStart(monthlyCourseStartDate(year, month));
}

export type RegistrationWindow = {
    /** 수강 개시일 */
    courseStartDate: string;
    /** 우선등록 시작일 (개시 2주 전) */
    priorityStartDate: string;
    /** 신규·일반등록 시작일 (개시 1주 전) */
    generalStartDate: string;
    /** 최종 납부기한 (개시 전날) */
    dueDate: string;
};

/** 임의 개시일 기준 납부 가능 구간 전체. 안내 문구·향후 대기자 우선등록 기능용. */
export function registrationWindowForCourseStart(courseStartDate: string): RegistrationWindow {
    return {
        courseStartDate,
        priorityStartDate: shiftDays(courseStartDate, PRIORITY_REGISTRATION_DAYS_BEFORE),
        generalStartDate: shiftDays(courseStartDate, GENERAL_REGISTRATION_DAYS_BEFORE),
        dueDate: dueDateForCourseStart(courseStartDate),
    };
}

/** 월 단위 수강의 납부 가능 구간. (예: 2026-08 → 07-18 우선 / 07-25 일반 / 07-31 기한) */
export function monthlyRegistrationWindow(year: number, month: number): RegistrationWindow {
    return registrationWindowForCourseStart(monthlyCourseStartDate(year, month));
}
