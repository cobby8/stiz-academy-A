-- 모집 중인 특강은 정원이 있어야 한다.
-- 연결 반과 담당 강사는 모집 이후 배정할 수 있으므로 이 제약에는 포함하지 않는다.
ALTER TABLE "SpecialProgramOffering"
  ADD CONSTRAINT "SpecialProgramOffering_open_capacity_check"
  CHECK (status <> 'OPEN' OR capacity IS NOT NULL) NOT VALID;

-- 기존 OPEN 데이터에 정원 미입력 건이 있으면 배포 전에 관리자가 먼저 보완해야 한다.
-- NOT VALID 제약도 신규 INSERT/UPDATE에는 즉시 적용된다.
-- 기존 데이터 검증은 운영 사전점검 후 별도 VALIDATE 단계에서 수행한다.
