/**
 * 시트 원장(StudentRegistrationLedger) ↔ 수강 등록(Enrollment) 정합성 판정 규칙.
 *
 * 왜 별도 파일인가?
 * - 판정 기준(몇 개월 안 보이면 퇴원으로 볼 것인가)은 "약관에서 나온 숫자"다.
 *   SQL 문자열 안에 숫자를 박아 두면 근거가 사라지고 테스트도 못 한다.
 *   그래서 상수와 순수 함수를 여기에 모아 두고, SQL은 이 상수를 끼워 넣어 쓴다.
 * - 외부 의존성 0 (DB/Prisma/Next 모두 import 하지 않는다) → 노드 단독 테스트 가능.
 */

/**
 * 약관상 인정되는 최대 휴원 기간(개월).
 * 근거: 이용약관 휴원 규정 — 휴원은 최대 2개월까지. 원장 확정(2026-07-26).
 * 즉 "2개월을 넘겨서도 시트에 안 나타나면" 더 이상 휴원 상태로 둘 근거가 없다.
 */
export const MAX_PAUSE_MONTHS = 2;

/**
 * 퇴원 후보로 볼 최소 "월 간격"(기준월 − 마지막 등장월).
 *
 * 왜 +2 인가? (한 칸 여유를 두는 이유)
 * - 기준월은 시트에 새로 올라온 "다음 달 등록분"이다. (예: 7월 25일에 올린 2026년 8월 시트)
 *   기준월은 아직 시작도 안 한 달이라 "결석한 달"로 세면 안 된다.
 * - 그래서 실제로 지나간 미등장 개월 수 = (기준월 − 마지막 등장월) − 1 이고,
 *   이 값이 MAX_PAUSE_MONTHS를 "초과"할 때만 퇴원 후보다.
 *   → 간격 >= MAX_PAUSE_MONTHS + 2
 *
 * 예) 기준월 2026년 8월
 *   - 마지막 등장 5월 → 간격 3, 지나간 미등장 2개월(6·7월) → 아직 휴원 범위 → 후보 아님
 *   - 마지막 등장 4월 → 간격 4, 지나간 미등장 3개월(5·6·7월) → 2개월 초과 → 퇴원 후보
 */
export const WITHDRAW_CANDIDATE_MIN_GAP_MONTHS = MAX_PAUSE_MONTHS + 2;

/** 연·월을 하나의 정수로. 연도 경계를 넘어서도 뺄셈이 성립하게 만든다. (2026년 1월 − 2025년 12월 = 1) */
export function toMonthIndex(year: number, month: number): number {
    return year * 12 + month;
}

/**
 * 기준월 대비 "이미 지나간" 미등장 개월 수.
 * 기준월 자체는 아직 시작하지 않은 달이므로 세지 않는다.
 * 마지막 등장이 기준월이거나 그 이후면 0.
 */
export function elapsedMissingMonths(lastSeenMonthIndex: number, referenceMonthIndex: number): number {
    const gap = referenceMonthIndex - lastSeenMonthIndex;
    if (gap <= 0) return 0;
    return gap - 1;
}

export type ReconcileTargetInput = {
    /** 마지막으로 시트에 등장한 달. 시트 이력이 아예 없으면 null (신규 등록자 등) */
    lastSeenMonthIndex: number | null;
    /** 이번에 올린 시트의 기준월(가장 최근 등록월) */
    referenceMonthIndex: number | null;
    /** 이번 기준월 시트에 ACTIVE로 등장하는가 (해당 반 기준) */
    presentInTargetMonth: boolean;
    /** 현재 DB의 Enrollment 상태 */
    enrollmentStatus: string;
};

export type ReconcileDecision =
    /** 시트에 있다 → 활성 유지/복원 */
    | "KEEP_ACTIVE"
    /** 시트에서 빠졌다 → 휴원 (기존 동작) */
    | "PAUSE"
    /** 약관상 휴원 한도를 넘겨 사라졌다 → 퇴원 "후보"(자동 확정 아님) */
    | "WITHDRAW_CANDIDATE"
    /** 판단 근거 없음 → 건드리지 않는다 */
    | "SKIP";

/**
 * 한 건의 (학생 × 반) 수강 등록을 어떻게 볼지 판정한다.
 *
 * 안전 규칙 (되돌리기 쉬운 쪽 우선):
 * 1. 시트 이력이 없으면(=신규 등록자·수기 등록 학생) 절대 퇴원 후보로 만들지 않는다.
 * 2. 이번 시트에 있으면 무조건 활성. (복귀 학생이 퇴원으로 남지 않게 하는 핵심 가드)
 * 3. 이미 퇴원 처리된 건은 다시 손대지 않는다.
 */
export function classifyReconcileTarget(input: ReconcileTargetInput): ReconcileDecision {
    const { lastSeenMonthIndex, referenceMonthIndex, presentInTargetMonth, enrollmentStatus } = input;

    // 2번 가드: 이번 달 시트에 ACTIVE로 있으면 상태와 무관하게 활성으로 되돌린다(복귀 경로).
    if (presentInTargetMonth) return "KEEP_ACTIVE";

    // 3번 가드: 이미 퇴원이면 더 내릴 상태가 없다.
    if (enrollmentStatus === "WITHDRAWN") return "SKIP";

    // 활성/휴원이 아닌 알 수 없는 상태는 건드리지 않는다.
    if (enrollmentStatus !== "ACTIVE" && enrollmentStatus !== "PAUSED") return "SKIP";

    // 1번 가드: 기준월을 모르거나 시트 이력이 아예 없으면 "며칠 빠졌는지"를 셀 수 없다.
    if (referenceMonthIndex === null || lastSeenMonthIndex === null) {
        // 이력이 없는 학생은 휴원 전환 대상(기존 동작)일 뿐, 절대 퇴원 후보가 아니다.
        return enrollmentStatus === "ACTIVE" ? "PAUSE" : "SKIP";
    }

    const gap = referenceMonthIndex - lastSeenMonthIndex;
    if (gap >= WITHDRAW_CANDIDATE_MIN_GAP_MONTHS) return "WITHDRAW_CANDIDATE";

    // 휴원 한도 안쪽이면 기존 동작 유지: 활성이면 휴원으로, 이미 휴원이면 그대로 둔다.
    return enrollmentStatus === "ACTIVE" ? "PAUSE" : "SKIP";
}
