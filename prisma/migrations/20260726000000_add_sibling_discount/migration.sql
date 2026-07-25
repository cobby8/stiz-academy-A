-- 방학특강 형제할인 10%: 할인액과 할인 사유를 스냅샷으로 남긴다. 추가만 하고, 멱등하게 작성한다.
-- 기존 행은 siblingDiscountSnapshot = 0 이 되어 금액이 전혀 바뀌지 않는다.

ALTER TABLE "SpecialProgramApplicationItem"
  ADD COLUMN IF NOT EXISTS "siblingDiscountSnapshot" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SpecialProgramApplicationItem"
  ADD COLUMN IF NOT EXISTS "discountReasonSnapshot" TEXT;

-- 기존 제약은 "최종금액 = 수강료 + 셔틀비"라서 할인이 들어가면 반드시 깨진다.
-- 할인을 뺀 형태로 교체한다. (DROP IF EXISTS -> ADD 순서라 여러 번 실행해도 안전하다.)
ALTER TABLE "SpecialProgramApplicationItem"
  DROP CONSTRAINT IF EXISTS "SpecialProgramApplicationItem_priceSnapshot_components";

ALTER TABLE "SpecialProgramApplicationItem"
  DROP CONSTRAINT IF EXISTS "SpecialProgramApplicationItem_siblingDiscountSnapshot_range";

-- 할인액은 음수가 될 수 없고, 할인 전 수강료를 넘을 수 없다(셔틀비는 할인 대상이 아니다).
ALTER TABLE "SpecialProgramApplicationItem"
  ADD CONSTRAINT "SpecialProgramApplicationItem_siblingDiscountSnapshot_range"
  CHECK ("siblingDiscountSnapshot" >= 0 AND "siblingDiscountSnapshot" <= "tuitionPriceSnapshot");

-- 최종금액 = 할인 전 수강료 - 할인액 + 셔틀비 (셔틀비 무할인)
ALTER TABLE "SpecialProgramApplicationItem"
  ADD CONSTRAINT "SpecialProgramApplicationItem_priceSnapshot_components"
  CHECK ("priceSnapshot" = "tuitionPriceSnapshot" - "siblingDiscountSnapshot" + "shuttleFeeSnapshot");
