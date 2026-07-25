import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error -- Node's type-stripping runner needs the runtime extension.
import { SIBLING_DISCOUNT_REASON, calculateSeasonalItemAmounts, isSameChildDuplicate, resolveSiblingKeys, siblingDiscountAmount, type SiblingCandidate } from "./sibling-discount.ts";

function candidate(key: string, childName: string, childBirth: string | null, phones: string[]): SiblingCandidate {
  return { key, childName, childBirth, phones };
}

test("형제 판정은 보호자 번호가 겹치면 성립한다", () => {
  const keys = resolveSiblingKeys([
    candidate("a", "이서원", "2015-09-17", ["01090981483"]),
    candidate("b", "이효성", "2014-01-04", ["01090981483"]),
    candidate("c", "박태이", "2016-04-11", ["01011112222"]),
  ]);
  assert.deepEqual([...keys].sort(), ["a", "b"]);
});

test("번호 집합은 합집합이라 아빠/엄마 번호가 서로 달라도 형제로 이어진다", () => {
  // 형은 신청서에 아빠 번호, 동생은 엄마 번호를 적었지만 원생 정보로 두 번호를 모두 알고 있는 상황.
  const keys = resolveSiblingKeys([
    candidate("a", "송서준", "2016-06-30", ["01000000001", "01000000002"]),
    candidate("b", "송서윤", "2018-02-11", ["01000000002"]),
  ]);
  assert.deepEqual([...keys].sort(), ["a", "b"]);
});

test("형제가 혼자 신청하면 할인 대상이 아니다", () => {
  const keys = resolveSiblingKeys([candidate("a", "우지율", "2016-09-05", ["01033334444"])]);
  assert.equal(keys.size, 0);
});

test("같은 아이 중복 등록은 형제로 잡히지 않는다", () => {
  // 이름 앞부분이 같고 생일도 같은 7건(이현준A/B, 김도현B, 김태훈A/B, 김주원B, 올리버)이 실제로 있다.
  const keys = resolveSiblingKeys([
    candidate("a", "이현준", "2014-10-20", ["01026197130"]),
    candidate("b", "이현준A", "2014-10-20", ["01026197130"]),
  ]);
  assert.equal(keys.size, 0);
  assert.equal(isSameChildDuplicate(
    candidate("a", "올리버", "2015-07-10", []),
    candidate("b", "올리버(올리 라고 부르면 됨)", "2015-07-10", []),
  ), true);
});

test("생일이 같아도 이름이 다르면 진짜 쌍둥이라 형제 할인을 받는다", () => {
  for (const [left, right] of [["장승리", "장하리"], ["이윤건", "이윤서"], ["김루나", "김루희"]]) {
    const keys = resolveSiblingKeys([
      candidate("a", left as string, "2015-05-05", ["01055556666"]),
      candidate("b", right as string, "2015-05-05", ["01055556666"]),
    ]);
    assert.deepEqual([...keys].sort(), ["a", "b"], `${left}/${right}는 쌍둥이로 인정되어야 한다`);
  }
});

test("생일 차이가 2일을 넘으면 이름이 비슷해도 중복 등록이 아니다", () => {
  assert.equal(isSameChildDuplicate(
    candidate("a", "김태훈", "2016-02-09", []),
    candidate("b", "김태훈A", "2016-02-20", []),
  ), false);
});

test("번호가 잘못 등록된 두 쌍은 형제로 묶이지 않는다", () => {
  assert.equal(resolveSiblingKeys([
    candidate("a", "이시윤", "2014-01-18", ["01066281801"]),
    candidate("b", "최현", "2013-09-26", ["01066281801"]),
  ]).size, 0);
  assert.equal(resolveSiblingKeys([
    candidate("a", "남건희", "2013-02-20", ["01095023155"]),
    candidate("b", "박하진", "2014-11-04", ["01095023155"]),
  ]).size, 0);
});

test("예외 쌍이라도 다른 번호까지 함께 겹치면 정상 형제로 본다", () => {
  const keys = resolveSiblingKeys([
    candidate("a", "이시윤", "2014-01-18", ["01066281801", "01077778888"]),
    candidate("b", "최현", "2013-09-26", ["01066281801", "01077778888"]),
  ]);
  assert.deepEqual([...keys].sort(), ["a", "b"]);
});

test("계산 순서는 기존회원가에서 10%를 빼고 셔틀비를 더한다", () => {
  const amounts = calculateSeasonalItemAmounts({ tuitionPriceSnapshot: 150000, shuttleFeeSnapshot: 0, sibling: true });
  assert.equal(amounts.tuitionPriceSnapshot, 150000);
  assert.equal(amounts.siblingDiscountSnapshot, 15000);
  assert.equal(amounts.priceSnapshot, 135000);
  assert.equal(amounts.discountReasonSnapshot, SIBLING_DISCOUNT_REASON);
});

test("셔틀비에는 할인이 붙지 않는다", () => {
  const amounts = calculateSeasonalItemAmounts({ tuitionPriceSnapshot: 150000, shuttleFeeSnapshot: 10000, sibling: true });
  assert.equal(amounts.siblingDiscountSnapshot, 15000);
  assert.equal(amounts.shuttleFeeSnapshot, 10000);
  // 145,000 = 150,000 - 15,000 + 10,000. 셔틀비가 할인되면 144,000이 된다.
  assert.equal(amounts.priceSnapshot, 145000);
});

test("형제가 아니면 할인액은 0이고 사유도 남지 않는다", () => {
  const amounts = calculateSeasonalItemAmounts({ tuitionPriceSnapshot: 243000, shuttleFeeSnapshot: 15000, sibling: false });
  assert.equal(amounts.siblingDiscountSnapshot, 0);
  assert.equal(amounts.discountReasonSnapshot, null);
  assert.equal(amounts.priceSnapshot, 258000);
});

test("할인액은 원 단위로 절사한다", () => {
  assert.equal(siblingDiscountAmount(243000), 24300);
  assert.equal(siblingDiscountAmount(198005), 19800);
  assert.equal(siblingDiscountAmount(9), 0);
});

test("여러 번 다시 계산해도 결과가 같다(멱등)", () => {
  const input = { tuitionPriceSnapshot: 198000, shuttleFeeSnapshot: 15000, sibling: true };
  const first = calculateSeasonalItemAmounts(input);
  // 저장된 결과를 다시 입력으로 넣어도 "할인 전 수강료"만 쓰므로 값이 흔들리지 않는다.
  const second = calculateSeasonalItemAmounts({
    tuitionPriceSnapshot: first.tuitionPriceSnapshot,
    shuttleFeeSnapshot: first.shuttleFeeSnapshot,
    sibling: true,
  });
  const third = calculateSeasonalItemAmounts({
    tuitionPriceSnapshot: second.tuitionPriceSnapshot,
    shuttleFeeSnapshot: second.shuttleFeeSnapshot,
    sibling: true,
  });
  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
  assert.equal(third.priceSnapshot, 198000 - 19800 + 15000);
});

test("할인 상태가 풀리면 원래 금액으로 정확히 되돌아간다", () => {
  const discounted = calculateSeasonalItemAmounts({ tuitionPriceSnapshot: 150000, shuttleFeeSnapshot: 10000, sibling: true });
  const restored = calculateSeasonalItemAmounts({
    tuitionPriceSnapshot: discounted.tuitionPriceSnapshot,
    shuttleFeeSnapshot: discounted.shuttleFeeSnapshot,
    sibling: false,
  });
  assert.equal(restored.priceSnapshot, 160000);
  assert.equal(restored.siblingDiscountSnapshot, 0);
});
