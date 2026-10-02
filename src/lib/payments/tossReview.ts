/**
 * 토스페이먼츠 **가맹 심사용** 테스트 결제 — 순수 계산만 담는다(DB·fetch 없음).
 *
 * ■ 왜 따로 두는가
 *   심사 담당자는 사이트에서 카드 결제창이 실제로 열리는지 본다. 그런데 학부모 청구서 결제
 *   (payment-ledger)에 테스트 키를 넣으면, 테스트 카드로 "결제"한 청구서가 **돈이 안 들어왔는데
 *   납부 완료로** 바뀐다. 그래서 심사용은 이름부터 다른 환경변수(TOSS_REVIEW_*)를 쓰고,
 *   청구서·DB 를 전혀 건드리지 않는다.
 *
 * ■ 실제 키가 들어오면 저절로 꺼진다
 *   두 키가 모두 `test_` 로 시작할 때만 켜진다. 라이브 키(live_)를 실수로 넣어도 버튼이 안 보이고
 *   API 는 404 다 — 심사용 화면으로 진짜 돈이 오가는 일을 막는다.
 */

export type TossReviewConfig = { clientKey: string; secretKey: string };

/** 프로그램 가격 칸 — 공개 프로그램 화면의 가격표와 같은 이름. */
export const REVIEW_PRICE_TIERS = [
    { key: "price", label: "월 수강료" },
    { key: "priceWeek1", label: "주 1회" },
    { key: "priceWeek2", label: "주 2회" },
    { key: "priceWeek3", label: "주 3회" },
    { key: "priceDaily", label: "매일반" },
] as const;

export type ReviewPriceTier = (typeof REVIEW_PRICE_TIERS)[number]["key"];

export type ReviewProgramPrices = {
    name: string;
    price: number | null;
    priceWeek1: number | null;
    priceWeek2: number | null;
    priceWeek3: number | null;
    priceDaily: number | null;
};

/** 두 키가 모두 테스트 키일 때만 설정을 돌려준다. 하나라도 비었거나 라이브 키면 null(=기능 꺼짐). */
export function readTossReviewConfig(env: Record<string, string | undefined>): TossReviewConfig | null {
    const clientKey = (env.TOSS_REVIEW_CLIENT_KEY ?? "").trim();
    const secretKey = (env.TOSS_REVIEW_SECRET_KEY ?? "").trim();
    if (!clientKey.startsWith("test_") || !secretKey.startsWith("test_")) return null;
    return { clientKey, secretKey };
}

export function isReviewPriceTier(value: unknown): value is ReviewPriceTier {
    return REVIEW_PRICE_TIERS.some((tier) => tier.key === value);
}

/**
 * 결제 금액과 주문명을 **서버의 프로그램 가격**으로 정한다. 화면이 보낸 금액은 믿지 않는다.
 * 가격이 없거나 0 이하면 null — 0원 결제창을 열지 않는다.
 */
export function resolveReviewOrder(program: ReviewProgramPrices, tier: ReviewPriceTier) {
    const amount = program[tier];
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) return null;
    const label = REVIEW_PRICE_TIERS.find((item) => item.key === tier)?.label ?? "월 수강료";
    const orderName = tier === "price" ? `${program.name} 월 수강료` : `${program.name} ${label} 월 수강료`;
    // 토스 주문명 최대 100자
    return { amount, orderName: orderName.slice(0, 100) };
}

/**
 * 토스 주문번호 규칙: 영문·숫자·-·_ 6~64자. 실제 청구서 주문과 섞이지 않게 REVIEW- 로 시작한다.
 * randomPart 는 호출하는 쪽이 crypto.randomUUID() 로 넘긴다(여기는 순수 함수로 둔다).
 */
export function makeReviewOrderId(randomPart: string) {
    const safe = randomPart.replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
    return `REVIEW-${safe}`;
}

export function isReviewOrderId(orderId: unknown): orderId is string {
    return typeof orderId === "string" && /^REVIEW-[A-Za-z0-9]{6,40}$/.test(orderId);
}
