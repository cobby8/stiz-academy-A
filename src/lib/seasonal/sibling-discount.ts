/**
 * 방학특강 형제할인 정책 (2026-07-26 원장님 확정)
 *
 * 1. 형제 판정: 보호자 전화번호가 겹치면 형제.
 *    한 학생의 번호 집합 = 신청서 보호자 번호 ∪ 매칭되는 원생의 User.phone ∪ Guardian.phone
 *    (아빠는 신청서에, 엄마는 원생 보호자에 등록된 경우가 실제로 있어서 "합집합"이어야 한다.)
 * 2. 할인 대상: 형제가 "같은 시즌 특강을 같이 신청한" 경우에만. 형제가 정규반만 다니면 대상이 아니다.
 * 3. 형제 전원 각각 10% (둘째부터가 아니다).
 * 4. 기존회원가에서 또 10%. 예) 기존회원 주2회 150,000 -> 135,000
 * 5. 수강료만 할인한다. 셔틀비는 절대 할인하지 않는다.
 * 6. 원 단위 절사(Math.floor).
 * 7. 같은 아이가 두 번 등록된 케이스는 형제가 아니다 -> 할인 제외.
 * 8. 번호가 잘못 등록되어 형제로 잡히는 쌍은 예외 목록으로 끊는다.
 *
 * ⚠️ 할인은 언제나 "할인 전 수강료(tuitionPriceSnapshot)"에서만 계산한다.
 *    이미 계산된 priceSnapshot을 다시 입력으로 쓰지 않으므로 몇 번을 재계산해도 결과가 같다(멱등).
 */

/** 표시용 비율. 실제 계산은 정수 연산(PERCENT)으로 해서 SQL과 결과가 어긋나지 않게 한다. */
export const SIBLING_DISCOUNT_RATE = 0.1;
export const SIBLING_DISCOUNT_PERCENT = 10;
export const SIBLING_DISCOUNT_REASON = "SIBLING_10";
/** 같은 아이 중복 등록으로 볼 생일 오차(일). 이 안이면서 이름 앞부분까지 같아야 중복으로 본다. */
export const DUPLICATE_CHILD_BIRTH_TOLERANCE_DAYS = 2;

export type SiblingCandidate = {
  /** 그룹 계산 단위 식별자. 실제로는 신청서 ID를 넣는다. */
  key: string;
  childName: string;
  /** 'YYYY-MM-DD'. 없으면 중복 판정을 하지 않는다. */
  childBirth: string | null;
  /** 숫자만 남긴 전화번호 목록 */
  phones: string[];
};

/**
 * 전화번호가 잘못 등록되어 남남인데 형제로 잡히는 쌍.
 * 원장님이 직접 확인해 주신 건이며, 원생 전화번호가 교정되면 이 규칙은 저절로 무의미해진다.
 * "이 번호로 연결된 이 두 이름"만 끊으므로, 같은 번호를 쓰는 진짜 형제가 나중에 생겨도 영향이 없다.
 */
export const MISREGISTERED_PHONE_EXCEPTIONS: ReadonlyArray<{ phone: string; names: readonly string[] }> = [
  { phone: "01066281801", names: ["이시윤", "최현"] },
  { phone: "01095023155", names: ["남건희", "박하진"] },
];

export function normalizeDiscountPhone(raw: string | null | undefined) {
  return (raw ?? "").replace(/[^0-9]/g, "");
}

export function normalizeChildName(raw: string | null | undefined) {
  return (raw ?? "").replace(/\s+/g, "");
}

function birthTime(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 같은 아이가 두 번 등록된 것으로 보이는지.
 * "이름 앞부분이 같고" + "생일 차이 2일 이내" 두 조건을 모두 만족할 때만 중복으로 본다.
 * 생일만으로 판정하면 진짜 쌍둥이(장승리/장하리, 이윤건/이윤서, 김루나/김루희)가 할인을 잃는다.
 */
export function isSameChildDuplicate(left: SiblingCandidate, right: SiblingCandidate) {
  const leftName = normalizeChildName(left.childName);
  const rightName = normalizeChildName(right.childName);
  if (!leftName || !rightName) return false;
  const shorter = leftName.length <= rightName.length ? leftName : rightName;
  const longer = shorter === leftName ? rightName : leftName;
  if (!longer.startsWith(shorter)) return false;

  const leftBirth = birthTime(left.childBirth);
  const rightBirth = birthTime(right.childBirth);
  if (leftBirth === null || rightBirth === null) return false;
  const diffDays = Math.abs(leftBirth - rightBirth) / 86_400_000;
  return diffDays <= DUPLICATE_CHILD_BIRTH_TOLERANCE_DAYS;
}

function sharedPhones(left: SiblingCandidate, right: SiblingCandidate) {
  const rightPhones = new Set(right.phones.map(normalizeDiscountPhone).filter(Boolean));
  return left.phones.map(normalizeDiscountPhone).filter((phone) => phone && rightPhones.has(phone));
}

/**
 * 번호 오등록 예외에 걸리는 쌍인지.
 * 두 사람을 이어주는 "공유 번호 전부"가 예외 규칙으로 설명될 때만 형제 연결을 끊는다.
 * 예외에 없는 번호가 하나라도 함께 걸려 있으면 정상 형제로 본다.
 */
export function isMisregisteredSiblingPair(left: SiblingCandidate, right: SiblingCandidate) {
  const shared = sharedPhones(left, right);
  if (shared.length === 0) return false;
  const leftName = normalizeChildName(left.childName);
  const rightName = normalizeChildName(right.childName);
  return shared.every((phone) => MISREGISTERED_PHONE_EXCEPTIONS.some((rule) => (
    rule.phone === phone
    && rule.names.includes(leftName)
    && rule.names.includes(rightName)
  )));
}

/** 두 신청이 형제로 이어지는지(간선이 생기는지) */
export function isSiblingEdge(left: SiblingCandidate, right: SiblingCandidate) {
  if (left.key === right.key) return false;
  if (sharedPhones(left, right).length === 0) return false;
  if (isSameChildDuplicate(left, right)) return false;
  if (isMisregisteredSiblingPair(left, right)) return false;
  return true;
}

/**
 * 같은 시즌 신청들 중 형제로 묶이는 신청 key 집합을 돌려준다.
 * 번호 공유로 간선을 만든 뒤 연결 요소를 구하고, 2명 이상인 그룹만 형제로 인정한다.
 * (중복 등록·번호 오등록은 간선 단계에서 미리 끊는다.)
 */
export function resolveSiblingKeys(candidates: SiblingCandidate[]) {
  const parent = new Map(candidates.map((candidate) => [candidate.key, candidate.key]));
  const find = (key: string): string => {
    let current = key;
    while (parent.get(current) !== current) {
      const next = parent.get(current) as string;
      parent.set(current, parent.get(next) as string);
      current = parent.get(current) as string;
    }
    return current;
  };
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const left = candidates[i];
      const right = candidates[j];
      if (!left || !right || !isSiblingEdge(left, right)) continue;
      const rootLeft = find(left.key);
      const rootRight = find(right.key);
      if (rootLeft !== rootRight) parent.set(rootLeft, rootRight);
    }
  }
  const groupSize = new Map<string, number>();
  for (const candidate of candidates) {
    const root = find(candidate.key);
    groupSize.set(root, (groupSize.get(root) ?? 0) + 1);
  }
  return new Set(candidates.filter((candidate) => (groupSize.get(find(candidate.key)) ?? 0) > 1).map((candidate) => candidate.key));
}

/** 형제할인 금액. 정수 연산이라 SQL의 `(tuition * 10) / 100`과 항상 같은 값이 나온다. */
export function siblingDiscountAmount(tuitionPriceSnapshot: number) {
  const tuition = Math.max(0, Math.trunc(tuitionPriceSnapshot));
  return Math.floor((tuition * SIBLING_DISCOUNT_PERCENT) / 100);
}

/**
 * 특강 신청 항목 한 건의 금액을 확정한다.
 * 계산 순서: ① 정가 -> ② 기존회원가 대체(호출부에서 이미 반영된 tuition) -> ③ 형제면 10% 절사 -> ④ + 셔틀비
 * 입력이 항상 "할인 전 수강료"라서 몇 번을 다시 계산해도 결과가 같다.
 */
export function calculateSeasonalItemAmounts(input: {
  tuitionPriceSnapshot: number;
  shuttleFeeSnapshot: number;
  sibling: boolean;
}) {
  const tuitionPriceSnapshot = Math.max(0, Math.trunc(input.tuitionPriceSnapshot));
  const shuttleFeeSnapshot = Math.max(0, Math.trunc(input.shuttleFeeSnapshot));
  const siblingDiscountSnapshot = input.sibling ? siblingDiscountAmount(tuitionPriceSnapshot) : 0;
  return {
    tuitionPriceSnapshot,
    siblingDiscountSnapshot,
    discountReasonSnapshot: siblingDiscountSnapshot > 0 ? SIBLING_DISCOUNT_REASON : null,
    shuttleFeeSnapshot,
    // 셔틀비는 할인 뒤에 더한다. 셔틀비에는 절대 할인이 붙지 않는다.
    priceSnapshot: tuitionPriceSnapshot - siblingDiscountSnapshot + shuttleFeeSnapshot,
  };
}
