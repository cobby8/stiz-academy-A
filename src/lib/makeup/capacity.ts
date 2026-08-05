/**
 * 보강 정원(잔여석) 계산 — 순수 로직 모음.
 *
 * 왜 별도 파일인가?
 *  - 화면(MakeupClient)·조회(queries.ts)·저장 검증(actions/admin.ts) 세 곳이 같은 식을 써야 한다.
 *    한 곳에서만 계산하면 "화면엔 여유, 저장은 초과" 같은 어긋남이 다시 생긴다.
 *  - prisma 를 import 하지 않아 tests/*.test.mjs 에서 그대로 불러 검증할 수 있다.
 */

/**
 * 좌석을 차지하는 보강 = 취소되지 않은 모든 보강(BOOKED/ATTENDED/NO_SHOW).
 * 기존 중복 방지 로직(regular-absence-admin)의 판정과 동일하게 맞춘다.
 */
export function activeMakeupSql(alias: string): string {
    return `${alias}.status <> 'CANCELLED'`;
}

/** 정원 초과 시 원장에게 보여줄 안내 문구(화면·서버 공통). */
export const MAKEUP_CAPACITY_FULL_MESSAGE =
    "이미 정원이 찼습니다. 다른 날짜나 반을 선택해 주세요.";

export type MakeupSeatUsage = {
    /** 반 정원 */
    capacity: number;
    /** 그 반의 실제 수강 인원(ACTIVE Enrollment, 통합 삭제된 학생 제외) */
    enrolled: number;
    /** 그 날 그 반에 이미 잡힌 활성 보강 수 */
    bookedMakeups: number;
};

/** 숫자로 강제 변환(SQL 결과가 문자열/BigInt/null 로 올 수 있어 방어). */
function toCount(value: unknown): number {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
}

/**
 * 잔여석 = 정원 − 수강 인원 − 그 날 활성 보강 수 (음수는 0으로 절삭).
 */
export function computeRemainingSeats(usage: MakeupSeatUsage): number {
    const remaining =
        toCount(usage.capacity) - toCount(usage.enrolled) - toCount(usage.bookedMakeups);
    return Math.max(0, remaining);
}

/**
 * 이 반·이 날짜에 보강을 1건 더 넣을 수 있는가?
 * 잔여석이 0 이하이면 마감(추가 불가).
 */
export function isMakeupSlotFull(usage: MakeupSeatUsage): boolean {
    return computeRemainingSeats(usage) <= 0;
}

/**
 * 화면에 표시할 좌석 문구.
 * loaded=false(아직 잔여석을 모름)일 때 총정원을 잔여석처럼 낙관 표시하지 않는다 —
 * 그게 이번 버그(정원 초과 예약)의 원인이었다.
 */
export function formatSeatLabel(
    usage: MakeupSeatUsage,
    loaded: boolean,
): string {
    const capacity = toCount(usage.capacity);
    if (!loaded) return `잔여석 확인 중 · 정원 ${capacity}명`;
    if (isMakeupSlotFull(usage)) return `정원 마감 · 정원 ${capacity}명`;
    return `잔여 ${computeRemainingSeats(usage)}석 · 정원 ${capacity}명`;
}
