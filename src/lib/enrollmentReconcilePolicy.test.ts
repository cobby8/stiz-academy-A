import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error -- Node의 타입 제거 실행기는 런타임 확장자를 요구한다.
import { MAX_PAUSE_MONTHS, WITHDRAW_CANDIDATE_MIN_GAP_MONTHS, classifyReconcileTarget, elapsedMissingMonths, toMonthIndex } from "./enrollmentReconcilePolicy.ts";

const AUG = toMonthIndex(2026, 8); // 기준월: 2026년 8월 시트

function decide(overrides: Partial<Parameters<typeof classifyReconcileTarget>[0]> = {}) {
    return classifyReconcileTarget({
        lastSeenMonthIndex: AUG,
        referenceMonthIndex: AUG,
        presentInTargetMonth: true,
        enrollmentStatus: "ACTIVE",
        ...overrides,
    });
}

test("월 인덱스는 연도 경계를 넘어도 뺄셈이 성립한다", () => {
    assert.equal(toMonthIndex(2026, 1) - toMonthIndex(2025, 12), 1);
    assert.equal(toMonthIndex(2026, 8) - toMonthIndex(2026, 4), 4);
    // 예전 방식(월 숫자만 사용)은 12월 → 1월에서 -11이 되어 완전히 뒤집힌다.
    assert.notEqual(1 - 12, toMonthIndex(2026, 1) - toMonthIndex(2025, 12));
});

test("기준월은 아직 지나지 않은 달이라 미등장 개월 수에서 빠진다", () => {
    assert.equal(elapsedMissingMonths(toMonthIndex(2026, 8), AUG), 0); // 이번 달 등장
    assert.equal(elapsedMissingMonths(toMonthIndex(2026, 7), AUG), 0); // 7월 등장 → 지나간 결석 0
    assert.equal(elapsedMissingMonths(toMonthIndex(2026, 6), AUG), 1);
    assert.equal(elapsedMissingMonths(toMonthIndex(2026, 5), AUG), 2); // 6·7월 = 휴원 한도 이내
    assert.equal(elapsedMissingMonths(toMonthIndex(2026, 4), AUG), 3); // 5·6·7월 = 한도 초과
});

test("임계값은 약관 휴원 한도(2개월)에서 유도된다", () => {
    assert.equal(MAX_PAUSE_MONTHS, 2);
    assert.equal(WITHDRAW_CANDIDATE_MIN_GAP_MONTHS, 4);
    // 후보가 되는 최소 간격은 '지나간 결석 3개월'과 같은 말이어야 한다.
    assert.equal(elapsedMissingMonths(AUG - WITHDRAW_CANDIDATE_MIN_GAP_MONTHS, AUG), MAX_PAUSE_MONTHS + 1);
});

test("케이스1 — 조용히 사라진 학생(4월 ACTIVE 후 실종)은 퇴원 후보", () => {
    // 실제 사례: 서채아(2026년 4월 ACTIVE로 마지막 등장, 이후 시트에서 사라짐 → DB는 휴원)
    assert.equal(
        decide({
            lastSeenMonthIndex: toMonthIndex(2026, 4),
            presentInTargetMonth: false,
            enrollmentStatus: "PAUSED",
        }),
        "WITHDRAW_CANDIDATE",
    );
    // 활성 상태로 남아 있어도 동일 판정
    assert.equal(
        decide({
            lastSeenMonthIndex: toMonthIndex(2026, 4),
            presentInTargetMonth: false,
            enrollmentStatus: "ACTIVE",
        }),
        "WITHDRAW_CANDIDATE",
    );
});

test("케이스1-경계 — 5월 마지막 등장은 아직 휴원 범위(후보 아님)", () => {
    assert.equal(
        decide({
            lastSeenMonthIndex: toMonthIndex(2026, 5),
            presentInTargetMonth: false,
            enrollmentStatus: "PAUSED",
        }),
        "SKIP",
    );
    assert.equal(
        decide({
            lastSeenMonthIndex: toMonthIndex(2026, 5),
            presentInTargetMonth: false,
            enrollmentStatus: "ACTIVE",
        }),
        "PAUSE",
    );
});

test("케이스2 — 명시적 휴원(직전 달 등장)은 기존대로 휴원 유지", () => {
    assert.equal(
        decide({
            lastSeenMonthIndex: toMonthIndex(2026, 7),
            presentInTargetMonth: false,
            enrollmentStatus: "ACTIVE",
        }),
        "PAUSE",
    );
    assert.equal(
        decide({
            lastSeenMonthIndex: toMonthIndex(2026, 7),
            presentInTargetMonth: false,
            enrollmentStatus: "PAUSED",
        }),
        "SKIP",
    );
});

test("케이스3 — 이미 퇴원 처리된 건은 다시 손대지 않는다", () => {
    assert.equal(
        decide({
            lastSeenMonthIndex: toMonthIndex(2026, 1),
            presentInTargetMonth: false,
            enrollmentStatus: "WITHDRAWN",
        }),
        "SKIP",
    );
});

test("케이스4 — 신규 등록자(시트 이력 없음)는 절대 퇴원 후보가 되지 않는다", () => {
    // 실제 사례: 김현호(2026-07-14 등록, 원장 이력 0행)
    assert.equal(
        decide({
            lastSeenMonthIndex: null,
            presentInTargetMonth: false,
            enrollmentStatus: "PAUSED",
        }),
        "SKIP",
    );
    assert.equal(
        decide({
            lastSeenMonthIndex: null,
            presentInTargetMonth: false,
            enrollmentStatus: "ACTIVE",
        }),
        "PAUSE",
    );
    // 8월 시트에 처음 등장한 신규 등록자
    assert.equal(
        decide({
            lastSeenMonthIndex: AUG,
            presentInTargetMonth: true,
            enrollmentStatus: "ACTIVE",
        }),
        "KEEP_ACTIVE",
    );
});

test("케이스5 — 복귀: 오래 사라졌다가 이번 시트에 다시 나타나면 무조건 활성", () => {
    for (const status of ["ACTIVE", "PAUSED", "WITHDRAWN"]) {
        assert.equal(
            decide({
                lastSeenMonthIndex: AUG,
                presentInTargetMonth: true,
                enrollmentStatus: status,
            }),
            "KEEP_ACTIVE",
            `복귀 판정 실패: ${status}`,
        );
    }
});

test("기준월을 알 수 없으면(빈 배치) 아무도 퇴원 후보가 되지 않는다", () => {
    assert.equal(
        decide({
            lastSeenMonthIndex: toMonthIndex(2026, 1),
            referenceMonthIndex: null,
            presentInTargetMonth: false,
            enrollmentStatus: "PAUSED",
        }),
        "SKIP",
    );
});

test("불변식 — 퇴원 후보는 언제나 '지나간 결석 > 약관 휴원 한도'를 만족한다", () => {
    for (let gap = 0; gap <= 12; gap += 1) {
        const decision = decide({
            lastSeenMonthIndex: AUG - gap,
            presentInTargetMonth: false,
            enrollmentStatus: "PAUSED",
        });
        const missing = elapsedMissingMonths(AUG - gap, AUG);
        if (decision === "WITHDRAW_CANDIDATE") {
            assert.ok(missing > MAX_PAUSE_MONTHS, `간격 ${gap}개월인데 결석 ${missing}개월로 후보가 됐다`);
        } else {
            assert.ok(missing <= MAX_PAUSE_MONTHS, `간격 ${gap}개월(결석 ${missing}개월)인데 후보가 아니다`);
        }
    }
});

test("미래 시트가 섞여 들어와도(간격 음수) 후보가 되지 않는다", () => {
    assert.equal(
        decide({
            lastSeenMonthIndex: toMonthIndex(2026, 12),
            presentInTargetMonth: false,
            enrollmentStatus: "PAUSED",
        }),
        "SKIP",
    );
    assert.equal(elapsedMissingMonths(toMonthIndex(2026, 12), AUG), 0);
});
